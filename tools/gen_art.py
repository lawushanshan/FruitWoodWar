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

# 全局骨架
HEAD = "Q版卡通游戏立绘，二头身Q版比例，粗黑描边，平涂上色带柔和阴影，明亮糖果色，可爱友好，手机休闲游戏画风，"
TAIL_CHAR = "，单个角色完整全身，侧面视角面朝右，角色居中占画面八成，纯绿色背景，无文字，无水印，无地面阴影，无多余物体"
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
    "u_fruit_tank": "一个圆滚滚的西瓜战士，戴着半片西瓜皮头盔，双手抱着一把大木锤，果肉红色脸颊，稳重又开心的表情，体型比其他兵种更宽更大只，",
    "u_fruit_ranged": "一个灵活的香蕉弓箭手，弯弯的香蕉身体，背着小箭袋，正在拉弓瞄准，专注可爱的表情，体型比坦克瘦小，",
    "u_fruit_aoe": "一个圆滚滚的榴莲小兵，身上有柔软的可爱尖刺，双手高举一颗点燃引线的圆形炸弹，憨厚狡黠的微笑，",
    "u_fruit_rush": "一个小巧的草莓精灵，红色带小籽的身体，头戴绿叶小帽，身体前倾做冲刺跑步姿势，身后有淡淡的速度线，精力充沛的表情，",
    "u_fruit_siege": "一台可爱的椰子主题投石车，木质小车身，车上装着发射架和大椰子，旁边跟着一颗有笑脸的椰子宝宝小兵在推动车子，",
    "u_wood_tank": "一个慈祥的老橡树人守卫，粗壮的树干身体，头顶茂密绿叶树冠，下巴有苔藓胡须，一只手臂挂着藤条编织的圆盾牌，体型宽大稳重，",
    "u_wood_ranged": "一个轻盈的蒲公英小射手，白色绒球脑袋，披着绿叶小披风，鼓起腮帮子吹出一支小飞镖，俏皮的表情，体型瘦小，",
    "u_wood_aoe": "一个戴紫色斑点蘑菇小尖帽的术士，手持一根顶端有发光孢子球的木法杖，狡黠可爱的微笑，袍子上有点点孢子光斑，",
    "u_wood_rush": "一个年轻的竹笋士兵，头戴锥形竹笋头盔，手握竹制短枪，身体前倾冲刺姿势，身后有淡淡速度线，元气满满，",
    "u_wood_siege": "一台南瓜主题攻城车，木质车架上固定着一个系着藤蔓绳索的巨大南瓜锤，车上装饰着藤蔓缠绕花纹，旁边一个戴叶子帽的小树精在推车，",
    "u_animal_tank": "一只壮实的Q版犀牛卫士，灰色厚实身体，身上挂着轻便装甲板，头顶标志性大角，一只手拿着小圆盾，憨厚勇敢的表情，体型宽大，",
    "u_animal_ranged": "一只灵活的Q版松鼠射手，蓬松的大尾巴，双手举着Y形木质弹弓正在瞄准，腰间挂着小弹药袋，机灵的表情，体型瘦小，",
    "u_animal_aoe": "一只智慧的Q版猫头鹰法师，头戴缀着星星月亮的小尖帽，鼻梁上架着小圆眼镜，翅膀举着一根顶端有发光星星的法杖，星星有蓝紫色微光，",
    "u_animal_rush": "一只敏捷的Q版猎豹侦察兵，金色斑点皮毛，腰间系着轻便小包，低姿快速奔跑，身后有淡淡速度线，眼神锐利又可爱，",
    "u_animal_siege": "一头强壮的Q版大象，用鼻子卷着绳索，推动一辆带有巨大青铜撞角的木质攻城槌车，稳步前进的踏实姿态，",
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
CARD_TAIL = "，竖版构图，主体居中占画面三分之二，四周留出装饰空间，纯绿色背景，无文字，无水印，无阴影"
CARDS = {
    "card_fruit_heal": ("fruit", "一杯冒热气的发光鲜榨果汁，杯边飘着小爱心气泡"),
    "card_fruit_atkUp": ("fruit", "一朵盛开的红色大花，花瓣间散发金色香气光环"),
    "card_fruit_splash": ("fruit", "一颗果汁炸弹在空中爆裂，果粒四溅"),
    "card_fruit_sunburst": ("fruit", "一轮微笑的太阳爆发出金色光芒万丈"),
    "card_fruit_tropical": ("fruit", "菠萝与香蕉卷成的热带风暴漩涡"),
    "card_fruit_fruitRage": ("fruit", "一面燃烧着橙色火焰的菠萝战旗"),
    "card_fruit_shield": ("fruit", "一面半透明的橙色果皮能量盾牌"),
    "card_fruit_regen": ("fruit", "阳光下闪闪发光的一株嫩芽"),
    "card_fruit_rain": ("fruit", "天空中落下各种小水果的可爱果雨"),
    "card_wood_rootNet": ("wood", "地面下交织发光的金色树根网络"),
    "card_wood_hpUp": ("wood", "一棵发光的大树，树心嵌着翠绿宝石"),
    "card_wood_spore": ("wood", "蘑菇喷出紫色发光孢子云团"),
    "card_wood_vine": ("wood", "粗壮藤蔓缠绕捆住一块大石头"),
    "card_wood_bark": ("wood", "一套厚重的树皮铠甲，泛着绿光"),
    "card_wood_bloom": ("wood", "百花齐放的花园，花瓣与小光点飞舞"),
    "card_wood_thorn": ("wood", "荆棘环绕生长的尖刺护罩"),
    "card_wood_growth": ("wood", "藤蔓快速缠绕生长的沙漏"),
    "card_wood_forest": ("wood", "发光的小树苗守护着一颗水晶"),
    "card_animal_crit": ("animal", "一支箭正中靶心，靶心迸发金光"),
    "card_animal_bloodlust": ("animal", "红色能量气流形成的狂热漩涡，只用发光能量表现，不要血液"),
    "card_animal_frenzy": ("animal", "爆发状的红橙色怒气符文能量"),
    "card_animal_howl": ("animal", "呐喊产生的白色声波冲击环"),
    "card_animal_pack": ("animal", "一群狼的剪影从四面围拢"),
    "card_animal_predator": ("animal", "一只发光的猎豹之眼，金色瞳孔"),
    "card_animal_stampede": ("animal", "兽群奔跑扬起尘土的壮观场面"),
    "card_animal_claw": ("animal", "三道闪光的爪痕划过"),
    "card_animal_survival": ("animal", "发光的金色进化之光环绕"),
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
    # 卡牌（后置）：挂阵营参考图，3:4 竖版
    for name, (fac, p) in CARDS.items():
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


# ==================== 即梦 API 客户端 ====================

class Jimeng:
    def __init__(self, ak: str, sk: str):
        self.ak, self.sk = ak, sk

    def _submit(self, body: dict) -> str:
        r = signed_post("CVSync2AsyncSubmitTask", self.ak, self.sk, body)
        if r.get("code") != 10000:
            raise RuntimeError("提交失败: %s (request_id=%s)" % (r.get("message"), r.get("request_id")))
        return r["data"]["task_id"]

    def _poll(self, req_key: str, task_id: str, timeout_s: int = 180) -> list:
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
            if code == 10000 and status == "generate_finish":
                urls = data.get("image_urls") or []
                if urls:
                    return urls
                raise RuntimeError("任务完成但没有图片 URL：%s" % json.dumps(data, ensure_ascii=False)[:300])
            if code != 10000:
                raise RuntimeError("查询失败: %s" % r.get("message"))
            time.sleep(3)
        raise RuntimeError("轮询超时（%ds）task_id=%s" % (timeout_s, task_id))

    def text2img(self, prompt: str, w: int, h: int) -> list:
        body = {
            "req_key": "jimeng_t2i_v30",
            "prompt": prompt,
            "use_pre_llm": False,  # 提示词已经很完整，关闭扩写避免跑偏
            "seed": -1,
            "width": w, "height": h,
        }
        return self._poll("jimeng_t2i_v30", self._submit(body))

    def img2img(self, prompt: str, image_path: str, w: int, h: int, scale: float = 0.4) -> list:
        """图生图智能参考：输入全家福锁风格。scale 越小越贴文本指令、越保留参考画风"""
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        body = {
            "req_key": "jimeng_i2i_v30",
            "binary_data_base64": [b64],
            "prompt": prompt,
            "seed": -1,
            "scale": scale,
            "width": w, "height": h,
        }
        return self._poll("jimeng_i2i_v30", self._submit(body))


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
