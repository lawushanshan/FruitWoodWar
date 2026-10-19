# FruitWoodWar 音频样包

这是一套首发占位音频，使用确定性合成生成，便于先完成玩法和平台适配。正式发行前可以按同名文件替换成录制或委托制作的音频，不需要改事件名称。

## 文件映射

| 文件 | 用途 |
| --- | --- |
| `music/battle_loop.wav` | 战斗循环背景音乐，约 38 秒，C 小调，100 BPM |
| `sfx/ui_click.wav` | UI 点击 |
| `sfx/build.wav` | 建造完成 |
| `sfx/upgrade.wav` | 升级和科研 |
| `sfx/coin.wav` | 工资、金币到账 |
| `sfx/card_confirm.wav` | 选卡确认 |
| `sfx/attack_light.wav` | 普通攻击 |
| `sfx/hit_heavy.wav` | 近战重击 |
| `sfx/siege_impact.wav` | 攻城落地 |
| `sfx/crystal_hit.wav` | 水晶受击 |
| `sfx/victory.wav` | 胜利 |
| `sfx/defeat.wav` | 失败 |
| `sfx/sudden_death.wav` | 决战时刻 |

WAV 使用 44.1kHz、16-bit PCM。背景音乐为立体声，短音效为单声道，Cocos Creator 可直接识别并导入。`AudioManager` 会优先播放已加载的 `AudioClip`，资源加载失败时自动回退到合成音效。

生成脚本：`tools/generate_audio_pack.py`。
