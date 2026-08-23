# -*- coding: utf-8 -*-
"""
美术素材批量后处理脚本（配合《DOCS/06-美术操作指南.md》第 12 节使用）

功能：把 tools/raw_art/ 下从即梦下载并抠好图的原图，
     自动「裁掉透明边缘 → 居中放正方形 → 高质量缩放」，
     输出到 assets/resources/art/ 对应分类目录。

用法：
  1. 原图按命名规范放入 tools/raw_art/ 对应子目录（units/buildings/ui/fx/map）
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

# 分类默认输出尺寸（正方形边长 px）
CATEGORY_SIZE = {
    "units": 128,
    "buildings": 128,
    "ui": 96,
    "fx": 96,
    "map": 1280,  # 地图：目标宽度，等比缩放
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


def process_transparent(img: Image.Image, size: int) -> Image.Image:
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


def process_opaque(img: Image.Image, target_w: int) -> Image.Image:
    """不透明图（地图 JPG）：等比缩放到目标宽度"""
    w, h = img.size
    if w <= 0:
        return img
    ratio = target_w / w
    return img.resize((target_w, max(1, round(h * ratio))), Image.LANCZOS)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


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
            is_map = category == "map"

            if is_map or img.mode != "RGBA":
                # 地图 / 无透明通道：等比缩放，输出 JPG
                result = process_opaque(img, size)
                out_path = os.path.join(out_dir, stem + ".jpg")
                result.convert("RGB").save(out_path, quality=88)
            else:
                result = process_transparent(img, size)
                out_path = os.path.join(out_dir, stem + ".png")
                result.save(out_path)

            print("  [完成]", category + "/" + stem, "->", result.size)
            total += 1

            # 建筑图额外输出建造栏小图标
            if category == "buildings" and stem in BUILDING_ICON_COPIES:
                icon_name = BUILDING_ICON_COPIES[stem]
                if img.mode == "RGBA":
                    icon = process_transparent(img, BUILDING_ICON_SIZE)
                    ensure_dir(os.path.join(OUT_ROOT, "ui"))
                    icon.save(os.path.join(OUT_ROOT, "ui", icon_name + ".png"))
                    print("  [附带] ui/" + icon_name, "->", icon.size)
                    total += 1

    print("处理完成，共 %d 张，输出目录：%s" % (total, os.path.abspath(OUT_ROOT)))


if __name__ == "__main__":
    main()
