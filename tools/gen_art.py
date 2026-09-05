# -*- coding: utf-8 -*-
"""
即梦 AI 批量生图脚本（配合《DOCS/08-美术操作指南.md》使用）

功能：
  - 内置全部美术提示词（15 兵种 / 3 大本营 / 8 建筑 / 地图 / UI / 特效 / 27 卡牌）
  - 调用火山引擎即梦 API（文生图 3.0 + 图生图智能参考 3.0）
  - 自动提交任务 → 轮询结果 → 下载到 tools/raw_art/ 对应目录
  - 支持上传阵营全家福 anchor_*.png 作为参考图（图生图，锁风格）

准备（一次性）：
  1. 注册火山引擎 console.volcengine.com → 实名认证
  2. 开通「即梦AI-文生图3.0」和「即梦AI-图生图3.0智能参考」（各送免费额度）
  3. 控制台 → 访问控制 → API访问密钥 → 创建 AK/SK
  4. 复制 tools/.env.example 为 tools/.env，填入两个密钥

用法：
  python tools/gen_art.py list                    # 查看全部任务
  python tools/gen_art.py run anchors             # 生成 3 张全家福（M3.0 第一步）
  python tools/gen_art.py run units --shots 3     # 批量生成 15 兵种，每张 3 候选抽卡
  python tools/gen_art.py run u_fruit_tank        # 只生成一个
  python tools/gen_art.py run ui fx buildings ... # 可同时跑多组
  python tools/gen_art.py run cards --no-anchor   # 卡牌（后置，不用参考图）

依赖：pip install requests
"""

import argparse
import base64
import datetime
import hashlib
import hmac
import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print("缺少 requests 库，请先执行：pip install requests")
    sys.exit(1)

# ==================== 配置 ====================

BASE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE, "raw_art")

HOST = "visual.volcengineapi.com"
REGION = "cn-north-1"
SERVICE = "cv"

# API 密钥：优先环境变量，其次 tools/.env 文件（.env 已加入 .gitignore，不会被提交）
def load_keys():
    ak = os.environ.get("VOLC_ACCESS_KEY", "")
    sk = os.environ.get("VOLC_SECRET_KEY", "")
    env_path = os.path.join(BASE, ".env")
    if (not ak or not sk) and os.path.isfile(env_path):
        for line in open(env_path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == "VOLC_ACCESS_KEY" and not ak:
                ak = v.strip()
            if k.strip() == "VOLC_SECRET_KEY" and not sk:
                sk = v.strip()
    return ak, sk


# ==================== 火山引擎 V4 签名 ====================

def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signature_key(secret: str, date: str) -> bytes:
    k = _sign(secret.encode("utf-8"), date)
    k = _sign(k, REGION)
    k = _sign(k, SERVICE)
    return _sign(k, "request")


def signed_post(action: str, ak: str, sk: str, payload: dict, timeout: int = 30) -> dict:
    """对 visual.volcengineapi.com 发起带 V4 签名的 POST 请求"""
    now = datetime.datetime.utcnow()
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    query = "Action=%s&Version=2022-08-31" % action
    uri = "/"
    body = json.dumps(payload, ensure_ascii=False)
    payload_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "Host": HOST,
        "X-Date": amz_date,
        "X-Content-Sha256": payload_hash,
    }
    signed_headers = ";".join(k.lower() for k in sorted(headers))
    canonical_headers = "".join("%s:%s\n" % (k.lower(), headers[k]) for k in sorted(headers))
    canonical_request = "\n".join(["POST", uri, query, canonical_headers, signed_headers, payload_hash])
    scope = "%s/%s/%s/request" % (date_stamp, REGION, SERVICE)
    string_to_sign = "\n".join([
        "HMAC-SHA256", amz_date, scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])
    sig = hmac.new(_signature_key(sk, date_stamp), string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    headers["Authorization"] = (
        "HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
        % (ak, scope, signed_headers, sig)
    )

    url = "https://%s/?%s" % (HOST, query)
    resp = requests.post(url, headers=headers, data=body.encode("utf-8"), timeout=timeout)
    resp.encoding = "utf-8"
    return resp.json()


# ==================== 提示词库（与《08-美术操作指南》一一对应） ====================

# 全局骨架：单主体约束放在最开头，防止参考图（全家福多角色）污染并排构图
# 攻城单位允许"载具+1个推车小人"的正常组合，其余兵种仅1个角色
HEAD = "画面中只有一个游戏单位主体，禁止出现2个及以上相同的角色或重复的主体，禁止并排站着多个独立人物，禁止复制主角，Q版卡通游戏立绘，二头身Q版比例，粗黑描边，平涂上色带柔和阴影，明亮糖果色，可爱友好，手机休闲游戏画风，"
TAIL_CHAR = "，单个角色完整全身，侧面视角面朝右，角色居中占画面八成，纯绿色背景，无文字，无水印，无地面阴影，无多余物体，整个画面就只有这1个角色"
TAIL_BUILD = "，单栋建筑完整可见，正视图，居中，纯绿色背景，无文字，无水印，无阴影，无多余物体"
FACTION = {
    "fruit": "多汁水果质感，橙红果绿柠檬黄配色，阳光明亮，",
    "wood": "森林木质质感，深绿木棕配色，苔藓叶片装饰，",
    "animal": "毛绒动物质感，琥珀黄皮棕配色，温暖野外气息，",
}

S1 = (1328, 1328)   # 1:1 标清档
S169 = (1664, 936)  # 16:9 标清档
S34 = (1104, 1472)  # 3:4 自定义（卡牌，宽高乘积在允许范围内）

# 每条任务：文件名 -> (分类, 提示词, 宽高, 参考图阵营或 None)
# 参考图：生成时自动读取 tools/anchor_{阵营}.png（全家福，由 M3.0 手动生成）
UNITS = {
    "u_fruit_tank": "一个圆滚滚的西瓜战士，整个身体是红色西瓜果肉带黑色西瓜籽，戴着半片绿色西瓜皮头盔，双手抱着一把大木锤，红色果肉脸颊，稳重又开心的表情，体型比其他兵种更宽更大只，有粗短的小手和脚，",
    "u_fruit_ranged": "一个灵活的香蕉弓箭手，整个身体是弯弯的黄色香蕉形状，带着绿色香蕉蒂小尾巴，背着小箭袋，正在拉弓瞄准，专注可爱的表情，体型比坦克瘦小，有可爱的小手小脚，",
    "u_fruit_aoe": "一个圆滚滚的榴莲小兵，整个身体是黄色榴莲带柔软的可爱尖刺，双手高举一颗点燃引线的圆形黑色炸弹，憨厚狡黠的微笑，粗短的小手小脚，",
    "u_fruit_rush": "一个小巧的草莓精灵，整个身体是红色草莓带黑色小籽，头戴绿色草莓叶子小帽，身体前倾做冲刺跑步姿势，身后有淡淡的速度线，精力充沛的开心表情，",
    "u_fruit_siege": "一个强壮的椰子投石机战士，整个身体是棕色硬壳大椰子，正面有圆圆的黑眼睛和憨厚笑脸，头顶绿色小叶子头发，两条粗壮椰子壳小腿稳稳站立，双手握着投石机发射杆，背后背着木质投石机机架和一颗黑色大椰子炮弹，造型是单只大椰子活体战士本身操作投石装备，",
    "u_wood_tank": "一个慈祥的老橡树人守卫，粗壮的棕色树干身体带树皮纹理，头顶茂密绿色树叶树冠，下巴有绿色苔藓做的白胡须，一只手臂挂着藤条编织的圆盾牌，体型宽大稳重，",
    "u_wood_ranged": "一个轻盈的蒲公英小射手，脑袋是圆滚滚的白色蒲公英绒球，披着绿色叶子小披风，鼓起腮帮子吹出一支小飞镖，俏皮的表情，体型瘦小，",
    "u_wood_aoe": "一个戴紫色斑点蘑菇小尖帽的术士，小袍子也是紫色，手持一根顶端有发光孢子球的木法杖，狡黠可爱的微笑，袍子上有点点绿色孢子光斑，",
    "u_wood_rush": "一个年轻的竹笋士兵，头戴锥形绿色竹笋尖头盔，手握竹制短枪，身体前倾冲刺姿势，身后有淡淡速度线，元气满满的表情，",
    "u_wood_siege": "一个强壮的南瓜战士推攻城撞槌，主体是圆滚滚橙色大南瓜，有三角形南瓜灯黄眼睛和锯齿大嘴但表情可爱，头顶绿色南瓜蒂和一片大叶子，长着绿色粗壮藤蔓当手臂，藤蔓双手紧握着一根粗大的攻城撞木，南瓜下方有四个棕色小木轮子支撑自己前进，造型是南瓜活体本身当战士，没有任何其他推车小人，",
    "u_animal_tank": "一只壮实的Q版犀牛卫士，灰色厚实带皮肤褶皱的身体，身上挂着轻便棕色装甲板，头顶标志性白色大角，一只手拿着小圆盾，憨厚勇敢的表情，体型宽大，",
    "u_animal_ranged": "一只灵活的Q版松鼠射手，棕色蓬松的大尾巴，双手举着Y形木质弹弓正在瞄准，腰间挂着小弹药袋，机灵的表情，体型瘦小，",
    "u_animal_aoe": "一只智慧的Q版猫头鹰法师，头戴缀着星星月亮的深蓝色小尖帽，鼻梁上架着小圆眼镜，翅膀举着一根顶端有发光金色星星的法杖，",
    "u_animal_rush": "一只敏捷的Q版猎豹侦察兵，金色皮毛带黑色斑点，腰间系着轻便小包，低姿快速奔跑，身后有淡淡速度线，眼神锐利又可爱，",
    "u_animal_siege": "一头强壮的Q版大象，灰色皮肤带大耳朵和白色象牙，用长鼻子卷着绳索，推动一辆带有巨大青铜撞角的木质攻城槌车，稳步前进，",
}
HQS = {
    "hq_fruit": "一座宏伟的黄金菠萝造型大本营建筑，金色菠萝外皮纹理，顶部是翠绿菠萝叶皇冠，底部有华丽基座，整体散发温暖的金色光芒，",
    "hq_wood": "一座巨大的发光小树苗形态大本营，粗壮树干中嵌着一颗发光的翠绿树心宝石，藤蔓温柔缠绕树干，头顶茂密发光的树冠，底部有树根基座，",
    "hq_animal": "一座高大的木石图腾柱大本营，柱身雕刻着威严又可爱的狮子脸，顶部装饰着两根弯弯的象牙，柱身刻有发光的琥珀色符文，底部有石制基座，",
}
ANCHORS = {
    "anchor_fruit": "同一画面的五个Q版角色并排站成一排：①圆滚滚的西瓜战士戴西瓜皮头盔抱大木锤，②弯弯香蕉身体的弓箭手拉弓瞄准，③圆滚滚榴莲小兵举着点燃引线的炸弹，④小巧草莓精灵戴绿叶小帽做冲刺跑步姿势，⑤推着椰子投石车的小兵，五个角色全身完整，各自独立不重叠，横向一排构图，纯绿色背景，无文字，无水印，无地面阴影",
    "anchor_wood": "同一画面的五个Q版角色并排站成一排：①慈祥老橡树人守卫持藤条盾牌，②白色绒球脑袋的蒲公英小射手吹飞镖，③戴尖帽的紫色斑点蘑菇术士举发光法杖，④戴竹笋头盔的竹笋士兵持竹枪冲刺，⑤推着大南瓜锤攻城车的小树精，五个角色全身完整，各自独立不重叠，横向一排构图，纯绿色背景，无文字，无水印，无地面阴影",
    "anchor_animal": "同一画面的五个Q版角色并排站成一排：①壮实灰犀牛卫士头顶大角持小盾牌，②大尾巴松鼠举Y形木弹弓瞄准，③戴星月小帽圆眼镜的猫头鹰举发光星星法杖，④金色斑点猎豹低姿疾跑，⑤大象推着带青铜撞角的攻城槌，五个角色全身完整，各自独立不重叠，横向一排构图，纯绿色背景，无文字，无水印，无地面阴影",
}
BUILDS = {
    "b_factory_tank": "一座坚固可爱的Q版小工厂，石砖墙面，大门是厚重的圆拱门，屋顶正中立着一面盾牌徽章，烟囱冒着一小团轻烟轮廓，",
    "b_factory_ranged": "一座轻巧可爱的Q版木质小工厂，屋顶挂着一个圆形箭靶招牌，门边斜靠着一支大弓，烟囱冒着一小团轻烟轮廓，",
    "b_factory_aoe": "一座魔法小屋样式的Q版工厂，尖尖的魔法师帽屋顶，屋顶悬浮着一颗发光的魔法球，墙面画着小星星装饰，烟囱冒着一小团轻烟轮廓，",
    "b_factory_rush": "一座轻快的Q版小工坊，屋顶装着一个小风车，门口插着一面飘扬的三角小旗，门口地面有一道淡淡的速度线装饰，烟囱冒着一小团轻烟轮廓，",
    "b_factory_siege": "一座重型的Q版工坊，宽大的木质车身造型，侧面有巨大的木车轮，屋顶装着一台小吊臂，堆着几根圆木原料，烟囱冒着一小团轻烟轮廓，",
    "b_academy": "一座庄严的Q版学院建筑，深蓝色尖顶塔楼，大门上方挂着剑与书卷交叉的徽章，屋顶飘着一面学院旗帜，窗户透出温暖的灯光，",
    "b_aura": "一座神奇的Q版魔法塔，细高的塔身点缀着蓝青色小水晶，塔顶悬浮着一个缓缓旋转的发光金色光环，塔身缠绕少量藤蔓装饰，",
    "b_tower": "一座可爱的Q版防御箭塔，石砌圆柱塔身，顶部是木质平台，平台上架着一台小弩炮，塔身挂着一面小盾牌装饰，",
}
UI_TAIL = "，单个物体居中，纯绿色背景，无文字，无水印，无阴影"
UI_HEAD = "Q版卡通游戏UI图标，粗黑描边，平涂上色，明亮糖果色，手机休闲游戏风格，"
UIS = {
    "ico_coin": "一个金色游戏金币，中间有星形凹痕",
    "ico_wave": "一个蓝色海浪卷起的波次旗帜",
    "ico_pop": "两个可爱小人头像并排",
    "ico_kill": "交叉的两把Q版小剑",
    "ico_star": "一颗饱满的黄色五角星",
    "ico_hp_red": "一颗红色心形宝石",
    "ico_hp_blue": "一颗蓝色水滴宝石",
    "ico_up": "一个绿色向上箭头",
    "ico_research": "一本摊开的古书与一个放大镜",
    "ico_time": "一个小沙漏",
    "ico_lock": "一把小金锁",
    "ico_settings": "一个齿轮",
    "ico_rarity_rare": "一个紫色宝石徽章",
    "ico_rarity_epic": "一个橙色宝石徽章",
    "ico_rarity_legendary": "一个金色发光宝石徽章",
    "ico_hand": "一只指向右边的可爱卡通手指",
}
PANELS = {
    "ui_panel_dark": "一个圆角矩形的深蓝木质游戏面板，四角有可爱的圆形铆钉装饰，边缘有浅色描边，适合做游戏信息面板背景",
    "ui_panel_light": "一个圆角矩形的浅米黄色木质游戏面板，四角有可爱的圆形铆钉装饰，边缘有浅色描边，适合做游戏信息面板背景",
    "ui_panel_card": "一个圆角矩形的深紫色魔法卡牌底板，边缘有华丽金色花纹边框，适合做游戏卡牌背景",
    "ui_btn_green": "一个圆角矩形的绿色卡通游戏按钮，饱满有立体感，顶部有高光，横长形状，适合做游戏主操作按钮",
    "ui_btn_blue": "一个圆角矩形的灰蓝色卡通游戏按钮，饱满有立体感，顶部有高光，横长形状，适合做游戏次级按钮",
}
FX_HEAD = "游戏特效贴图，柔光半透明质感，明亮糖果色，手机休闲游戏风格，"
FXS = {
    "fx_glow": "一个柔和的白色圆形光晕，边缘透明渐变",
    "fx_star": "一颗黄色四角星光四射，边缘透明",
    "fx_smoke": "一团蓬松的白色烟雾，边缘透明",
    "fx_debris": "三四块可爱的小碎石碎片",
    "fx_slash": "一道白色月牙形斩击弧光",
    "fx_ring": "一个蓝青色扩散圆环，边缘透明",
    "fx_heal": "飘散的绿色小加号与光点",
    "fx_boom": "一个橙黄色爆炸火光圆，边缘透明",
    "fx_arrow": "一支横放的Q版小箭矢，尖头朝右",
    "fx_bolt": "一颗发光的圆形魔法弹球",
    "fx_boulder": "一颗圆滚滚的灰色大石块",
}
MAP_PROMPT = ("俯视角卡通战场草地地图，明亮欢快的手机休闲游戏画风，平涂上色带柔和阴影，"
              "左右两侧是大片翠绿草地，草地上散布着可爱的小花、小蘑菇、小石头装饰，"
              "画面上下边缘有一排排小树，中间大部分区域是干净的空草地，"
              "无道路，无河流，无桥梁，无角色，无建筑，无文字，无水印，色彩柔和统一的Q版卡通风格，横向构图")

# 卡牌插画（后置，M3.5 之后跑）：文件名 -> (阵营, 主体描述)
# ⚠️ 关键约束：卡牌是"物品/效果/场景特写"，严禁出现角色/人物/动物/生物！
CARD_TAIL = "，竖版构图，主体居中占画面三分之二，四周留出装饰空间，纯绿色背景，无文字，无水印，无阴影，纯物品或效果特写，严禁出现任何角色、人物、动物、生物、拟人形象"
CARDS = {
    # === 水果王国 ===
    "card_fruit_heal": ("fruit", "一杯冒热气的发光鲜榨果汁，杯边飘着小爱心气泡，纯物品特写"),
    "card_fruit_atkUp": ("fruit", "一朵盛开的红色大花，花瓣间散发金色香气光环，纯物品特写"),
    "card_fruit_splash": ("fruit", "一颗果汁炸弹在空中爆裂的瞬间，橙色果汁和果粒向四周飞溅，爆炸冲击波扩散，纯效果特写，不要角色"),
    "card_fruit_sunburst": ("fruit", "一轮微笑的卡通太阳在画面中央爆发出万丈金色光芒，光芒呈放射状向四周扩散，纯效果特写，不要角色"),
    "card_fruit_tropical": ("fruit", "菠萝与香蕉卷成的热带风暴漩涡，水果碎片在漩涡中旋转，纯效果特写"),
    "card_fruit_fruitRage": ("fruit", "一面燃烧着橙色火焰的菠萝造型战旗，旗帜在风中飘扬，纯物品特写，不要角色"),
    "card_fruit_shield": ("fruit", "一面半透明的橙色果皮能量盾牌，盾牌表面有流动的能量纹路，悬浮在空中，纯物品特写，不要角色"),
    "card_fruit_regen": ("fruit", "阳光下闪闪发光的一株嫩芽，嫩芽周围有金色光点环绕，纯物品特写"),
    "card_fruit_rain": ("fruit", "天空中落下各种小水果的可爱果雨，西瓜片、橙子、草莓、柠檬从空中飘落，纯场景特写，不要角色"),
    "card_fruit_harvest": ("fruit", "Q版卡通游戏卡牌插画，画面正中央是一个陶土蜂蜜罐，罐口溢出流淌的金色蜂蜜，蜂蜜中混杂着闪闪发光的金币，金色光点环绕罐身飞舞，橙金色暖光氛围，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_fruit_swarm": ("fruit", "Q版卡通游戏卡牌插画，画面中只有一群金色蜜蜂形光点组成的箭头状飞行编队，每只蜜蜂光点带橙色光尾迹，从左下向右上飞行，画面中没有任何真实角色人物动物生物，纯光点效果，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_fruit_coreBlast": ("fruit", "Q版卡通游戏卡牌插画，画面正中央是一颗巨大果核在爆裂的瞬间，橙色冲击波呈放射状扩散，果核碎片与果汁光点向四周飞溅，橙红爆炸光芒，纯效果特写，画面中没有任何角色人物动物生物，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    # === 绿木林 ===
    "card_wood_rootNet": ("wood", "地面下交织发光的金色树根网络特写，树根如血管般蔓延，发出温暖的金色光芒，纯场景特写，不要角色、不要树人"),
    "card_wood_hpUp": ("wood", "一棵发光的大树树干特写，树心嵌着一颗璀璨的翠绿宝石，宝石向外散发绿色光晕，纯物品特写，不要角色、不要树人"),
    "card_wood_spore": ("wood", "Q版卡通游戏卡牌插画，画面正中央是一朵红色蘑菇，蘑菇顶部喷发出巨大的紫色发光孢子云团，紫色孢子如烟雾般向上扩散，周围飘散着小孢子颗粒，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_wood_vine": ("wood", "粗壮绿色藤蔓紧紧缠绕捆住一块大石头的特写，藤蔓上有小叶片，纯物品特写，不要角色、不要树人"),
    "card_wood_bark": ("wood", "Q版卡通游戏卡牌插画，画面正中央是一套悬浮的树皮铠甲，铠甲由层层叠叠的棕色树皮板块组成，板块之间泛着绿色荧光纹路，铠甲无人穿着，独立悬浮在空中，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_wood_bloom": ("wood", "Q版卡通游戏卡牌插画，画面正中央是一簇盛开的鲜花，粉色白色黄色紫色蓝色各种花朵争奇斗艳，花瓣和发光小光点在花丛上方飞舞，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_wood_thorn": ("wood", "荆棘环绕生长形成的尖刺护罩特写，带刺藤蔓交织成球形防护罩，泛着绿色光芒，纯物品特写，不要角色、不要树人"),
    "card_wood_growth": ("wood", "藤蔓快速缠绕生长的沙漏，木质沙漏被绿色藤蔓缠绕，沙子正在流动，纯物品特写"),
    "card_wood_forest": ("wood", "游戏卡牌插画，纯物品效果特写，画面中没有任何生物角色人物动物，只有：一棵发光的小树苗和一颗悬浮的水晶，树苗和水晶都散发着翠绿色光芒"),
    "card_wood_acorn": ("wood", "Q版卡通游戏卡牌插画，画面正中央是一颗巨大的橡果，果壳已经打开，内部装满闪闪发光的金币和绿色光珠，橡果表面泛着翠绿色光晕，金色光点环绕，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_wood_vineGuard": ("wood", "Q版卡通游戏卡牌插画，画面中只有数根粗壮的绿色藤蔓从地面拔起，交织成一面藤蔓盾墙，藤蔓上长着小叶片，泛着翠绿色荧光，藤蔓无人操控独立生长，画面中没有任何角色人物动物生物，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_wood_forestWail": ("wood", "Q版卡通游戏卡牌插画，画面正中央是一朵巨大的蘑菇在爆发的瞬间，翠绿色孢子冲击波从蘑菇伞盖呈环形扩散，绿色光点与孢子颗粒向四周飞溅，纯效果特写，画面中没有任何角色人物动物生物，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    # === 动物庄园 ===
    "card_animal_crit": ("animal", "一支箭矢正中靶心的特写，靶心处迸发出耀眼的金色光芒和冲击波，纯效果特写，不要角色、不要动物"),
    "card_animal_bloodlust": ("animal", "Q版卡通游戏卡牌插画，画面正中央是一个巨大的红色能量漩涡，红色和橙色能量气流如龙卷风般旋转，漩涡中心是纯能量没有任何生物，只用发光能量表现，不要血液，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_frenzy": ("animal", "Q版卡通游戏卡牌插画，画面正中央是爆发状的红橙色怒气能量，能量中漂浮着发光的古代符文，符文在火焰能量中闪烁，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_howl": ("animal", "Q版卡通游戏卡牌插画，画面中只有同心圆白色声波冲击环，声波环从画面正中央向四周扩散，环上有细小的能量裂纹，画面中没有任何角色人物动物生物，纯效果，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_pack": ("animal", "Q版卡通游戏卡牌插画，深绿色背景上，画面四周边缘排列着多个狼形剪影，剪影是半透明的深绿色影子，画面正中央是空的只有背景色没有任何角色人物动物生物，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_predator": ("animal", "一只发光的猎豹之眼特写，金色瞳孔放大，眼睛周围有能量光晕，纯物品特写，只要眼睛不要全身"),
    "card_animal_stampede": ("animal", "Q版卡通游戏卡牌插画，画面中只有漫天飞扬的黄褐色尘土云团和地面上的多个动物蹄印，尘土向四周扩散，画面中没有任何角色人物动物生物，纯场景，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_claw": ("animal", "三道闪光的利爪痕划过空气的特写，爪痕带白色光芒和能量残影，纯效果特写，不要角色、不要动物"),
    "card_animal_survival": ("animal", "Q版卡通游戏卡牌插画，画面正中央是一个发光的金色魔法阵，魔法阵由多个同心圆环和古代符文组成，金色光芒从阵中心向外辐射，粗黑描边，平涂上色，竖版构图，纯绿色背景，无文字无水印"),
    # === 动物庄园·新增（经济/召唤/同归于尽） ===
    "card_animal_hoard": ("animal", "Q版卡通游戏卡牌插画，画面正中央是一堆金色的动物骨头与金币堆成的小山，最顶端一根大骨头发着金色光芒，金币散落四周，金棕色暖光氛围，画面中没有任何角色人物动物生物，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_boarRush": ("animal", "Q版卡通游戏卡牌插画，画面中只有地面上多道深深的野猪蹄印印痕向远处延伸，蹄印间黄褐色尘土飞扬，尘土带呈冲刺流动感，画面中没有任何角色人物动物生物，纯场景，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
    "card_animal_lastRoar": ("animal", "Q版卡通游戏卡牌插画，画面正中央是一个巨大的发光爪印印记烙在地面上，金红色冲击波从爪印中心向外爆发扩散，能量裂纹向四周延伸，纯效果特写，画面中没有任何角色人物动物生物，粗黑描边，平涂上色，明亮糖果色，竖版构图，纯绿色背景，无文字无水印"),
}

# 分组：group -> {文件名: (目标目录, 完整提示词, 宽高, 参考图阵营)}
def build_tasks():
    tasks = {}
    # 全家福（文生图，无参考图；存到 tools/ 根目录当锚点，不进 raw_art）
    for name, p in ANCHORS.items():
        fac = name.replace("anchor_", "")
        full = HEAD + p
        tasks[name] = ("_anchors", full, S169, None, fac)
    # 兵种：挂阵营参考图
    for name, p in UNITS.items():
        fac = name.split("_")[1]
        tasks[name] = ("units", HEAD + p + FACTION[fac] + TAIL_CHAR, S1, fac, None)
    # 大本营：挂阵营参考图
    for name, p in HQS.items():
        fac = name.replace("hq_", "")
        tasks[name] = ("units", HEAD + p + FACTION[fac] + TAIL_BUILD, S1, fac, None)
    # 建筑：通用，不挂阵营参考图（任意全家福锁画风即可，这里用 fruit）
    for name, p in BUILDS.items():
        full = HEAD + p + TAIL_BUILD
        tasks[name] = ("buildings", full, S1, "fruit", None)
    # UI
    for name, p in UIS.items():
        tasks[name] = ("ui", UI_HEAD + "一个" + p + UI_TAIL, S1, None, None)
    for name, p in PANELS.items():
        tasks[name] = ("ui", UI_HEAD + "一个" + p + UI_TAIL, S1, None, None)
    # 特效
    for name, p in FXS.items():
        tasks[name] = ("fx", FX_HEAD + "一个" + p + UI_TAIL, S1, None, None)
    # 卡牌（后置）：3:4 竖版
    # NO_ANCHOR_CARDS：这些卡牌不挂参考图（AI看到角色参考图会自动画角色，关闭参考图可避免）
    NO_ANCHOR_CARDS = {
        "card_wood_spore", "card_wood_bark", "card_wood_bloom", "card_wood_forest",
        "card_animal_bloodlust", "card_animal_frenzy", "card_animal_howl",
        "card_animal_pack", "card_animal_stampede", "card_animal_survival",
        # 新增三类卡牌（anchor 参考图已清理，统一纯文生图）
        "card_fruit_harvest", "card_fruit_swarm", "card_fruit_coreBlast",
        "card_wood_acorn", "card_wood_vineGuard", "card_wood_forestWail",
        "card_animal_hoard", "card_animal_boarRush", "card_animal_lastRoar",
    }
    for name, (fac, p) in CARDS.items():
        if name in NO_ANCHOR_CARDS:
            # 不挂参考图，纯文生图
            full = HEAD + p + CARD_TAIL
            tasks[name] = ("cards", full, S34, None, None)
        else:
            full = HEAD + p + "，" + FACTION[fac].rstrip("，") + CARD_TAIL
            tasks[name] = ("cards", full, S34, fac, None)
    # 地图
    tasks["map_bg"] = ("map", MAP_PROMPT, S169, None, None)
    return tasks

GROUPS = {
    "anchors": lambda t: t.startswith("anchor_"),
    "units": lambda t: t.startswith("u_"),
    "hqs": lambda t: t.startswith("hq_"),
    "buildings": lambda t: t.startswith("b_"),
    "ui": lambda t: t.startswith("ui_") or t.startswith("ico_"),
    "fx": lambda t: t.startswith("fx_"),
    "cards": lambda t: t.startswith("card_"),
    "map": lambda t: t == "map_bg",
    "all": lambda t: True,
}


# ==================== 即梦 API 客户端（Seedream 4.6） ====================
# 官方文档：https://www.volcengine.com/docs/85621/2275082
# req_key 统一：jimeng_seedream46_cvtob（文生图+图生图通用，传binary_data_base64自动切换图生图模式）
# scale：整数 1~100，越大越听文本指令（默认50）
# force_single=True：强制单图输出，避免并排多角色污染

REQ_KEY_46 = "jimeng_seedream46_cvtob"


class Jimeng:
    def __init__(self, ak: str, sk: str):
        self.ak, self.sk = ak, sk

    def _submit(self, body: dict) -> str:
        r = signed_post("CVSync2AsyncSubmitTask", self.ak, self.sk, body)
        if r.get("code") != 10000:
            raise RuntimeError("提交失败: %s (request_id=%s)" % (r.get("message"), r.get("request_id")))
        return r["data"]["task_id"]

    def _poll(self, req_key: str, task_id: str, timeout_s: int = 360) -> list:
        """轮询直到出图，返回图片 URL 列表"""
        deadline = time.time() + timeout_s
        query = {
            "req_key": req_key,
            "task_id": task_id,
            # 返回 URL 而非 base64，且不加水印
            "req_json": json.dumps({
                "logo_info": {"add_logo": False, "language": 0, "opacity": 0},
                "return_url": True,
            }),
        }
        while time.time() < deadline:
            r = signed_post("CVSync2AsyncGetResult", self.ak, self.sk, query)
            code = r.get("code")
            data = r.get("data") or {}
            status = data.get("status", "")
            # 即梦 API 返回的完成状态有两种：generate_finish / done
            if code == 10000 and status in ("generate_finish", "done"):
                urls = data.get("image_urls") or []
                if urls:
                    return urls
                raise RuntimeError("任务完成但没有图片 URL：%s" % json.dumps(data, ensure_ascii=False)[:300])
            if status in ("failed", "error", "generate_failed"):
                raise RuntimeError("任务失败 status=%s: %s" % (status, json.dumps(data, ensure_ascii=False)[:300]))
            if code != 10000:
                raise RuntimeError("查询失败: %s" % r.get("message"))
            time.sleep(4)
        raise RuntimeError("轮询超时（%ds）task_id=%s" % (timeout_s, task_id))

    def text2img(self, prompt: str, w: int, h: int) -> list:
        """Seedream 4.6 文生图：统一 req_key，force_single强制单图"""
        body = {
            "req_key": REQ_KEY_46,
            "prompt": prompt,
            "force_single": True,
            "width": w, "height": h,
        }
        return self._poll(REQ_KEY_46, self._submit(body))

    def img2img(self, prompt: str, image_path: str, w: int, h: int, scale: int = 75) -> list:
        """Seedream 4.6 图生图（智能参考）：统一 req_key，scale整数1~100，force_single强制单图
        scale=75：文本指令权重高（保证单角色），同时保留参考图画风"""
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        body = {
            "req_key": REQ_KEY_46,
            "binary_data_base64": [b64],  # 传图即自动切图生图模式
            "prompt": prompt,
            "force_single": True,  # 关键：强制只出1张单图
            "scale": scale,        # 文本影响程度：75%听文本，25%看参考图
            "width": w, "height": h,
        }
        return self._poll(REQ_KEY_46, self._submit(body))


def anchor_path(fac: str) -> str:
    """阵营全家福参考图路径：tools/anchor_{阵营}.png（M3.0 定稿后放在这里）"""
    return os.path.join(BASE, "anchor_%s.png" % fac)


def download(url: str, dest: str) -> bool:
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:
        print("    [下载失败]", dest, e)
        return False


# ==================== 命令入口 ====================

def cmd_list(tasks):
    print("共 %d 个生成任务：\n" % len(tasks))
    for g, match in GROUPS.items():
        names = [n for n in tasks if match(n)]
        if names:
            print("[%s] %d 个" % (g, len(names)))
            print("  " + "  ".join(sorted(names)))
            print()


def cmd_run(targets, shots, no_anchor):
    ak, sk = load_keys()
    if not ak or not sk:
        print("未找到 API 密钥。请复制 tools/.env.example 为 tools/.env 并填入 AK/SK，")
        print("或设置环境变量 VOLC_ACCESS_KEY / VOLC_SECRET_KEY。")
        sys.exit(1)
    cli = Jimeng(ak, sk)
    tasks = build_tasks()

    # 展开目标：组名 → 组内全部；否则视为单个任务名
    names = []
    for t in targets:
        if t in GROUPS:
            names += [n for n in tasks if GROUPS[t](n)]
        elif t in tasks:
            names.append(t)
        else:
            print("[跳过] 未知任务/组名：%s（用 list 命令查看全部）" % t)
    names = sorted(set(names))
    if not names:
        print("没有可执行的任务。")
        return

    print("将生成 %d 个任务 × %d 候选 = %d 次调用（0.2 元/张，免费额度 200 次）\n"
          % (len(names), shots, len(names) * shots))

    ok, fail = 0, 0
    for i, name in enumerate(names, 1):
        cat, prompt, (w, h), anchor_fac, _ = tasks[name]
        # 参考图：任务声明了阵营且没被 --no-anchor 关闭，且参考图存在
        use_ref = (not no_anchor) and anchor_fac and os.path.isfile(anchor_path(anchor_fac))
        if anchor_fac and not use_ref and not no_anchor:
            print("  [提示] 未找到 %s，%s 将退化为文生图（风格可能漂移）"
                  % (os.path.basename(anchor_path(anchor_fac)), name))

        dest_dir = RAW_DIR if cat != "_anchors" else BASE
        os.makedirs(dest_dir, exist_ok=True)
        for shot in range(1, shots + 1):
            suffix = "" if shots == 1 else ("__cand%d" % shot)
            dest = os.path.join(dest_dir, cat if cat != "_anchors" else "", "%s%s.png" % (name, suffix))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            try:
                if use_ref:
                    urls = cli.img2img(prompt, anchor_path(anchor_fac), w, h)
                else:
                    urls = cli.text2img(prompt, w, h)
                if download(urls[0], dest):
                    print("[%d/%d] %s%s ✓" % (i, len(names), name, suffix))
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                print("[%d/%d] %s%s ✗ %s" % (i, len(names), name, suffix, e))
                fail += 1
    print("\n完成：成功 %d，失败 %d" % (ok, fail))
    print("下一步：浏览 raw_art 挑图 → 删除候选后缀 __candN 重命名保留那张 → 运行 process_art.py")


def main():
    parser = argparse.ArgumentParser(description="即梦 AI 批量生图")
    parser.add_argument("cmd", choices=["list", "run"], help="list=查看任务；run=生成")
    parser.add_argument("targets", nargs="*", help="组名（units/ui/...）或任务名（u_fruit_tank）")
    parser.add_argument("--shots", type=int, default=1, help="每张生成几个候选（默认 1，抽卡建议 3）")
    parser.add_argument("--no-anchor", action="store_true", help="不使用全家福参考图（纯文生图）")
    args = parser.parse_args()

    if args.cmd == "list":
        cmd_list(build_tasks())
    else:
        if not args.targets:
            parser.error("run 需要至少一个目标，例如：python tools/gen_art.py run units")
        cmd_run(args.targets, args.shots, args.no_anchor)


if __name__ == "__main__":
    main()
