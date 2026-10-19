/**
 * AudioManager —— Web Audio 合成音效管理器
 *
 * 职责：
 *  - 使用 Web Audio API 合成简单音效，无需外部音频文件
 *  - 支持：建造、金币、击杀、胜利、失败、攻击、受击
 *  - 音量控制与静音开关
 *  - 正式音频资源可用时走 Cocos AudioSource；资源加载失败时回退 Web Audio 合成
 *
 * 音效设计原则：
 *  - 欢快、简洁，符合 Q 版卡通风格
 *  - 每个音效时长 ≤ 0.5 秒，避免拖沓
 */

import { AudioClip, AudioSource, director, Node, resources } from 'cc';

/** 音效类型 */
export type SoundEffect = 'build' | 'coin' | 'kill' | 'victory' | 'defeat' | 'attack' | 'hit' | 'upgrade' | 'click' | 'card_confirm' | 'crystal_hit' | 'siege_impact' | 'sudden_death';

/** 高频音效最小播放间隔（毫秒）：战斗事件密集，限流避免嘈杂与性能浪费 */
const THROTTLE_MS: Partial<Record<SoundEffect, number>> = {
    attack: 100,
    hit: 100,
};

export class AudioManager {

    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private muted: boolean = false;
    private volume: number = 0.3;
    private audioNode: Node | null = null;
    private sfxSource: AudioSource | null = null;
    private musicSource: AudioSource | null = null;
    private clips = new Map<SoundEffect, AudioClip>();
    private musicClip: AudioClip | null = null;
    private musicRequested = false;
    private nativeLoading = false;
    /** 各音效上次播放时间戳（毫秒），用于高频音效节流 */
    private lastPlayedAt: Partial<Record<SoundEffect, number>> = {};

    /** 初始化音频上下文（需在用户交互后调用） */
    init() {
        this.ensureNativeSources();
        this.loadNativePack();
        if (this.ctx) return;
        try {
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
        } catch {
            // 静默降级（测试环境等无 AudioContext）
        }
    }

    /** 播放指定音效 */
    play(effect: SoundEffect) {
        if (this.muted) return;
        const nativeClip = this.clips.get(effect);
        if (nativeClip && this.sfxSource) {
            this.sfxSource.volume = this.volume;
            this.sfxSource.playOneShot(nativeClip, 1);
            return;
        }
        if (!this.ctx || !this.masterGain) return;

        // 高频音效节流：间隔内重复触发直接丢弃（团战时攻防事件每秒可达数十次）
        const throttle = THROTTLE_MS[effect];
        if (throttle) {
            const now = Date.now();
            if (now - (this.lastPlayedAt[effect] ?? 0) < throttle) return;
            this.lastPlayedAt[effect] = now;
        }

        // 确保上下文在运行状态（浏览器要求用户交互后才能播放）
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        switch (effect) {
            case 'build': this.playBuild(); break;
            case 'coin': this.playCoin(); break;
            case 'kill': this.playKill(); break;
            case 'victory': this.playVictory(); break;
            case 'defeat': this.playDefeat(); break;
            case 'attack': this.playAttack(); break;
            case 'hit': this.playHit(); break;
            case 'upgrade': this.playUpgrade(); break;
            case 'click': this.playClick(); break;
            case 'card_confirm': this.playCardConfirm(); break;
            case 'crystal_hit': this.playHit(); break;
            case 'siege_impact': this.playHit(); break;
            case 'sudden_death': this.playSuddenDeath(); break;
        }
    }

    playMusic() {
        this.musicRequested = true;
        if (!this.musicClip || !this.musicSource || this.muted) return;
        this.musicSource.volume = this.volume * 0.22;
        this.musicSource.clip = this.musicClip;
        this.musicSource.loop = true;
        this.musicSource.play();
    }

    stopMusic() {
        this.musicRequested = false;
        this.musicSource?.stop();
    }

    /** 设置音量（0~1） */
    setVolume(v: number) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
        if (this.sfxSource) this.sfxSource.volume = this.muted ? 0 : this.volume;
        if (this.musicSource) this.musicSource.volume = this.muted ? 0 : this.volume * 0.22;
    }

    /** 静音切换 */
    setMuted(muted: boolean) {
        this.muted = muted;
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.volume;
        if (this.sfxSource) this.sfxSource.volume = muted ? 0 : this.volume;
        if (this.musicSource) {
            this.musicSource.volume = muted ? 0 : this.volume * 0.22;
            if (!muted && this.musicRequested) this.playMusic();
        }
    }

    /** 是否静音 */
    isMuted(): boolean {
        return this.muted;
    }

    // ==================== 音效合成 ====================

    /** 建造：上升音阶 + 短促 */
    private playBuild() {
        this.playTone(440, 0.08, 'square');
        this.scheduleTone(660, 0.08, 'square', 80);
        this.scheduleTone(880, 0.1, 'square', 160);
    }

    /** 金币：清脆叮声 */
    private playCoin() {
        this.playTone(1200, 0.06, 'sine');
        this.scheduleTone(1600, 0.08, 'sine', 60);
    }

    /** 击杀：短促低频 */
    private playKill() {
        this.playTone(200, 0.1, 'sawtooth');
        this.scheduleTone(150, 0.15, 'sawtooth', 50);
    }

    /** 胜利：上升和弦 */
    private playVictory() {
        this.playTone(523, 0.15, 'sine'); // C5
        this.scheduleTone(659, 0.15, 'sine', 150); // E5
        this.scheduleTone(784, 0.2, 'sine', 300); // G5
        this.scheduleTone(1047, 0.3, 'sine', 450); // C6
    }

    /** 失败：下降音阶 */
    private playDefeat() {
        this.playTone(440, 0.2, 'sawtooth');
        this.scheduleTone(330, 0.2, 'sawtooth', 200);
        this.scheduleTone(220, 0.3, 'sawtooth', 400);
    }

    /** 攻击：极短促噪声 */
    private playAttack() {
        this.playTone(300, 0.04, 'square');
    }

    /** 受击：低频冲击 */
    private playHit() {
        this.playTone(120, 0.08, 'triangle');
    }

    /** 升级：明亮上升 */
    private playUpgrade() {
        this.playTone(600, 0.1, 'sine');
        this.scheduleTone(800, 0.1, 'sine', 100);
        this.scheduleTone(1200, 0.15, 'sine', 200);
    }

    /** 按钮点击：极短清脆 tick（所有 UI 按钮统一的操作确认音） */
    private playClick() {
        this.playTone(880, 0.03, 'sine');
    }

    private playCardConfirm() {
        this.playTone(392, 0.10, 'sine');
        this.scheduleTone(587, 0.12, 'sine', 100);
        this.scheduleTone(784, 0.15, 'sine', 220);
    }

    private playSuddenDeath() {
        this.playTone(196, 0.18, 'sawtooth');
        this.scheduleTone(293, 0.18, 'square', 180);
        this.scheduleTone(392, 0.28, 'sine', 360);
    }

    // ==================== 底层 ====================

    /** 播放单个音调 */
    private playTone(freq: number, duration: number, type: OscillatorType) {
        if (!this.ctx || !this.masterGain || this.muted) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch {
            // 静默降级
        }
    }

    private scheduleTone(freq: number, duration: number, type: OscillatorType, delayMs: number) {
        setTimeout(() => this.playTone(freq, duration, type), delayMs);
    }

    private ensureNativeSources() {
        if (this.audioNode) return;
        const scene = director.getScene();
        if (!scene) return;
        this.audioNode = new Node('AudioManager');
        this.audioNode.parent = scene;
        this.sfxSource = this.audioNode.addComponent(AudioSource);
        this.musicSource = this.audioNode.addComponent(AudioSource);
        this.sfxSource.playOnAwake = false;
        this.musicSource.playOnAwake = false;
        this.sfxSource.volume = this.volume;
        this.musicSource.volume = this.volume * 0.22;
    }

    private loadNativePack() {
        if (this.nativeLoading || this.clips.size > 0) return;
        this.nativeLoading = true;
        const files: Array<[SoundEffect, string]> = [
            ['click', 'audio/sfx/ui_click'], ['build', 'audio/sfx/build'], ['upgrade', 'audio/sfx/upgrade'],
            ['coin', 'audio/sfx/coin'], ['card_confirm', 'audio/sfx/card_confirm'],
            ['attack', 'audio/sfx/attack_light'], ['hit', 'audio/sfx/hit_heavy'],
            ['crystal_hit', 'audio/sfx/crystal_hit'], ['siege_impact', 'audio/sfx/siege_impact'],
            ['sudden_death', 'audio/sfx/sudden_death'],
            ['victory', 'audio/sfx/victory'], ['defeat', 'audio/sfx/defeat'],
        ];
        for (const [effect, path] of files) {
            resources.load(path, AudioClip, (err, clip) => {
                if (!err && clip) this.clips.set(effect, clip);
            });
        }
        resources.load('audio/music/battle_loop', AudioClip, (err, clip) => {
            if (!err && clip) {
                this.musicClip = clip;
                if (this.musicRequested) this.playMusic();
            }
        });
    }
}
