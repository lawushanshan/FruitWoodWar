# Kenney Particle Pack

- Source page: https://kenney.nl/assets/particle-pack
- Download: https://kenney.nl/media/pages/assets/particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip
- Author: Kenney Vleugels (Kenney.nl), with additional contributors named in License.txt.
- License: Creative Commons Zero (CC0), commercial use permitted. Original archive license retained in License.txt.
- Retrieved: 2026-10-20 (Asia/Shanghai).

Selected transparent PNGs are stored in `assets/resources/art/fx/kenney/`, resized to 128×128 with alpha preserved. `tools/import_particle_pack.py` fetches only the selected entries using HTTP ranges and verifies each original entry's ZIP CRC before conversion. No Unity package or black-background assets are bundled.

Runtime uses circle_01, circle_03, smoke_03, smoke_06, star_04, slash_03 and trace_01. spark_07 is retained as an unused candidate and is not preloaded. These are particle building blocks, not pre-authored complete animations. Movement, timing, color and composition are implemented in BattleEffects.

`fx/boulder_clean.png` is derived from this project's existing `fx_boulder.png`, not from Kenney. Its original source and rights are unchanged; the transformation script only removes green spill and the painted ground shadow.
