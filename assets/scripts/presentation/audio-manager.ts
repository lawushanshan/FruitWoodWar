/**
 * AudioManager —— Web Audio 合成音效管理器
 *
 * 职责：
 *  - 使用 Web Audio API 合成简单音效，无需外部音频文件
 *  - 支持：建造、金币、击杀、胜利、失败、攻击、受击
 *  - 音量控制与静音开关
 *  - 不导入 cc，可在 Node 环境运行（静默降级）
 *
 * 音效设计原则：
 *  - 欢快、简洁，符合 Q 版卡通风格
 *  - 每个音效时长 ≤ 0.5 秒，避免拖沓
 */

/** 音效类型 */
export type SoundEffect = 'build' | 'coin' | 'kill' | 'victory' | 'defeat' | 'attack' | 'hit' | 'upgrade';

export class AudioManager {

    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private muted: boolean = false;
    private volume: number = 0.3;

    /** 初始化音频上下文（需在用户交互后调用） */
    init() {
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
        if (!this.ctx || !this.masterGain || this.muted) return;

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
        }
    }

    /** 设置音量（0~1） */
    setVolume(v: number) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }

    /** 静音切换 */
    setMuted(muted: boolean) {
        this.muted = muted;
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.volume;
    }

    /** 是否静音 */
    isMuted(): boolean {
        return this.muted;
    }

    // ==================== 音效合成 ====================

    /** 建造：上升音阶 + 短促 */
    private playBuild() {
        this.playTone(440, 0.08, 'square');
        setTimeout(() => this.playTone(660, 0.08, 'square'), 80);
        setTimeout(() => this.playTone(880, 0.1, 'square'), 160);
    }

    /** 金币：清脆叮声 */
    private playCoin() {
        this.playTone(1200, 0.06, 'sine');
        setTimeout(() => this.playTone(1600, 0.08, 'sine'), 60);
    }

    /** 击杀：短促低频 */
    private playKill() {
        this.playTone(200, 0.1, 'sawtooth');
        setTimeout(() => this.playTone(150, 0.15, 'sawtooth'), 50);
    }

    /** 胜利：上升和弦 */
    private playVictory() {
        this.playTone(523, 0.15, 'sine'); // C5
        setTimeout(() => this.playTone(659, 0.15, 'sine'), 150); // E5
        setTimeout(() => this.playTone(784, 0.2, 'sine'), 300); // G5
        setTimeout(() => this.playTone(1047, 0.3, 'sine'), 450); // C6
    }

    /** 失败：下降音阶 */
    private playDefeat() {
        this.playTone(440, 0.2, 'sawtooth');
        setTimeout(() => this.playTone(330, 0.2, 'sawtooth'), 200);
        setTimeout(() => this.playTone(220, 0.3, 'sawtooth'), 400);
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
        setTimeout(() => this.playTone(800, 0.1, 'sine'), 100);
        setTimeout(() => this.playTone(1200, 0.15, 'sine'), 200);
    }

    // ==================== 底层 ====================

    /** 播放单个音调 */
    private playTone(freq: number, duration: number, type: OscillatorType) {
        if (!this.ctx || !this.masterGain) return;
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
}
