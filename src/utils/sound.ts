// src/utils/sound.ts
import bgmUrl from '../assets/Hillside_Artillery.mp3';
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmAudio: HTMLAudioElement | null = null;

  // 브라우저 정책 상 사용자의 첫 상호작용(클릭) 시 오디오 컨텍스트를 활성화해야 합니다.
  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5; // 전체 볼륨 50%
      this.masterGain.connect(this.ctx.destination);
    }
  }

  // 🎵 BGM 재생
  public playBGM() {
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(bgmUrl);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.4;
    }
    this.bgmAudio.play().catch(e => console.warn('BGM Auto-play suppressed:', e));
  }
  
  // 🎵 BGM 정지
  public stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  // 🚀 발사음 (피치가 빠르게 떨어지는 소리)
  public playShoot() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    
    osc.frequency.setValueAtTime(600, this.ctx.currentTime); // 시작 주파수
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3); // 끝 주파수
    
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // 💥 폭발음 (화이트 노이즈를 생성해 묵직한 필터를 씌움)
  // 💥 무기 타입별 폭발음 생성
  public playExplosion(type: number, volumeMultiplier: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    
    let duration = 0.5;
    let filterType: BiquadFilterType = 'lowpass';
    let startFreq = 1000;
    let endFreq = 100;

    // 🎨 무기 타입(0~6)에 따른 소리 주파수 & 질감(Filter) 디자인
    switch(type) {
      case 0: // 철갑탄 (묵직하고 깊은 폭발)
        duration = 0.8; startFreq = 800; endFreq = 50; break;
      case 1: // 소이탄 (다다닥 터지는 파편음, 짧고 날카로움)
        duration = 0.3; filterType = 'bandpass'; startFreq = 2000; endFreq = 500; break;
      case 2: // 백린탄 (치이익 타들어가는 가스 소리)
        duration = 1.2; filterType = 'highpass'; startFreq = 3000; endFreq = 1000; break;
      case 3: // 바운스탄 (적당히 둔탁하고 짧은 폭발)
        duration = 0.4; startFreq = 1500; endFreq = 200; break;
      // (4번 텔레포트는 폭발음 대신 아래의 playTeleport() 사용)
      case 5: // 스마트유도탄 (SF 느낌의 찌릿한 폭발)
        duration = 0.6; filterType = 'bandpass'; startFreq = 4000; endFreq = 200; break;
      case 6: // 에어버스트 (공중에서 넓고 길게 퍼지는 거대한 굉음)
        duration = 1.5; startFreq = 500; endFreq = 20; volumeMultiplier *= 1.5; break;
    }

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1; // 화이트 노이즈 생성
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // 필터를 통해 질감 깎기
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

    // 볼륨 페이드 아웃
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0 * volumeMultiplier, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start();
  }

  // 🥷 텔레포트탄 전용 '뾰로롱' 사운드
  public playTeleport() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine'; // 부드러운 사인파
    osc.frequency.setValueAtTime(1500, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4); // 피치가 급격히 떨어짐
    
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // 🏀 바운스음 (통통 튀는 귀여운 소리)
  public playBounce() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // 🖱️ UI 클릭/무기교체음 (짧고 경쾌한 틱 소리)
  public playClick() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }
}

export const soundManager = new SoundEngine();
