# -*- coding: utf-8 -*-
"""
美术素材批量后处理脚本（配合《DOCS/06-美术操作指南.md》第 12 节使用）

功能：把 tools/raw_art/ 下从即梦下载的原图，自动处理并输出到
     assets/resources/art/ 对应分类目录：
       ① 绿底自动去除兜底（忘记抠图的 #00FF00 背景图自动去底）
       ② 裁掉透明边缘 → 居中放正方形 → 高质量缩放（LANCZOS）
       ③ 卡牌：保持主体比例，居中放入 220×286
       ④ 地图：等比缩放 + 居中裁切成正好 1280×720，输出 JPG
       ⑤ 建筑图自动附赠 96×96 建造栏图标（ico_build_*）到 ui/

用法：
  1. 原图按命名规范放入 tools/raw_art/ 对应子目录（units/buildings/ui/fx/cards/map）
  2. 运行：python tools/process_art.py
  3. 到 Cocos Creator 里刷新即可看到新资源

依赖：pip install pillow
"""

import os
from PIL import Image

# 路径：脚本所在目录为基准
BASE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE, "raw_art")
OUT_ROOT = os.path.join(BASE, "..", "assets", "resources", "art")

# ==================== 尺寸规则（与操作指南 12.3 一致） ====================

# 分类默认输出尺寸：int = 正方形边长；(宽, 高) = 非方形目标
CATEGORY_SIZE = {
    "units": 128,
    "buildings": 128,
    "ui": 96,
    "fx": 96,
    "cards": (220, 286),      # 卡牌插画（非方形，保持比例居中）
    "map": (1280, 720),       # 地图（cover 裁切到设计分辨率）
}

# 个别文件覆盖（按文件名不含扩展名匹配）
EXTRA_SIZE = {
    # 大本营更大
    "hq_fruit": 192,
    "hq_wood": 192,
    "hq_animal": 192,
    # 建筑特例
    "b_academy": 144,
    "b_tower": 96,
    # 面板需要更高清（九宫格）
    "ui_panel_dark": 256,
    "ui_panel_light": 256,
    "ui_panel_card": 256,
    # 特效光效类稍大
    "fx_glow": 128,
    "fx_boom": 128,
    "fx_ring": 128,
}

# 建筑图额外输出一份小图到 ui/ 当建造栏图标
BUILDING_ICON_COPIES = {
    "b_factory_tank": "ico_build_tank",
    "b_factory_ranged": "ico_build_ranged",
    "b_factory_aoe": "ico_build_aoe",
    "b_factory_rush": "ico_build_rush",
    "b_factory_siege": "ico_build_siege",
    "b_academy": "ico_build_academy",
    "b_aura": "ico_build_aura",
}
BUILDING_ICON_SIZE = 96

MIN_EDGE = 64  # 小于该边长的输入直接警告跳过（可能下载错了缩略图）

# ==================== 绿底自动去除（兜底，正式抠图建议用即梦智能抠图） ====================

# 判定为背景绿的阈值：绿很亮、红蓝都很低（匹配 #00FF00 纯绿）
# 注意阈值上限 95 的意义：绿木林阵营亮绿 #66BB6A(102,187,106) 的红蓝分量是 102/106，
# 超过 95 不会被误伤；AI 生成的纯绿背景红蓝分量通常 <80，仍能正常去除。
def _is_bg_green(r, g, b):
    return g > 150 and r < 95 and b < 95


def has_transparency(img: Image.Image) -> bool:
    """图片是否已有透明像素（说明已经抠过图）"""
    if img.mode != "RGBA":
        return False
    return img.getextrema()[3][0] < 255


def green_fraction(img: Image.Image, sample: int = 64) -> float:
    """采样估算绿色背景占比（0~1）"""
    small = img.convert("RGB").resize((sample, sample))
    data = small.tobytes()
    total_px = len(data) // 3
    green = 0
    for i in range(0, len(data), 3):
        if _is_bg_green(data[i], data[i + 1], data[i + 2]):
            green += 1
    return green / total_px


def remove_green(img: Image.Image) -> Image.Image:
    """把接近纯绿的背景像素置为全透明"""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and _is_bg_green(r, g, b):
                px[x, y] = (r, g, b, 0)
    return img


# ==================== 处理函数 ====================

def process_square(img: Image.Image, size: int) -> Image.Image:
    """透明 PNG：裁掉透明边缘 → 居中放正方形画布 → 缩放到目标尺寸"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def process_fit(img: Image.Image, tw: int, th: int) -> Image.Image:
    """非方形（卡牌）：裁边 → 保持比例缩放 → 居中放入固定画布留边"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    ratio = min(tw / w, th / h)
    nw, nh = max(1, round(w * ratio)), max(1, round(h * ratio))
    img = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(img, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def process_map(img: Image.Image, tw: int, th: int) -> Image.Image:
    """地图：等比放大/缩小到铺满目标 → 居中裁切成正好 tw×th"""
    img = img.convert("RGB")
    w, h = img.size
    ratio = max(tw / w, th / h)
    nw, nh = max(tw, round(w * ratio)), max(th, round(h * ratio))
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - tw) // 2, (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


# ==================== 主流程 ====================

def main() -> None:
    if not os.path.isdir(RAW_DIR):
        print("未找到 raw_art 目录，请先按操作指南创建：", RAW_DIR)
        return

    total = 0
    for category in sorted(os.listdir(RAW_DIR)):
        cat_dir = os.path.join(RAW_DIR, category)
        if not os.path.isdir(cat_dir) or category not in CATEGORY_SIZE:
            continue
        out_dir = os.path.join(OUT_ROOT, category)
        ensure_dir(out_dir)

        for fname in sorted(os.listdir(cat_dir)):
            if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue
            stem, _ = os.path.splitext(fname)
            fpath = os.path.join(cat_dir, fname)
            img = Image.open(fpath)
            if min(img.size) < MIN_EDGE:
                print("  [跳过] 尺寸过小，请下载原图：", fname, img.size)
                continue

            size = EXTRA_SIZE.get(stem, CATEGORY_SIZE[category])

            # ---------- 地图：cover 裁切，输出 JPG ----------
            if category == "map":
                result = process_map(img, size[0], size[1])
                out_path = os.path.join(out_dir, stem + ".jpg")
                result.save(out_path, quality=88)
                print("  [完成]", category + "/" + stem, "->", result.size)
                total += 1
                continue

            # ---------- 其余：透明 PNG 路径 ----------
            notes = ""
            if not has_transparency(img):
                # 没抠过图：尝试自动去绿底
                if green_fraction(img) >= 0.03:
                    img = remove_green(img)
                    notes = "（已自动去绿底）"
                else:
                    print("  [警告]", fname, "不透明且未检测到绿底，请先抠图！本次按原图缩放输出")

            if isinstance(size, tuple):
                result = process_fit(img, size[0], size[1])
            else:
                result = process_square(img, size)
            out_path = os.path.join(out_dir, stem + ".png")
            result.save(out_path)
            print("  [完成]", category + "/" + stem, "->", result.size, notes)
            total += 1

            # 建筑图额外输出建造栏小图标
            if category == "buildings" and stem in BUILDING_ICON_COPIES:
                icon_name = BUILDING_ICON_COPIES[stem]
                icon = process_square(img, BUILDING_ICON_SIZE)
                ensure_dir(os.path.join(OUT_ROOT, "ui"))
                icon.save(os.path.join(OUT_ROOT, "ui", icon_name + ".png"))
                print("  [附带] ui/" + icon_name, "->", icon.size)
                total += 1

    print("处理完成，共 %d 张，输出目录：%s" % (total, os.path.abspath(OUT_ROOT)))


if __name__ == "__main__":
    main()
