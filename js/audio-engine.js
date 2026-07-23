// vibrolux - Web Audio Engine
class VibroluxEngine {
    constructor() {
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.analyser = null;
        this.isRunning = false;
        
        // Effects
        this.vibratoLFO = null;
        this.vibratoGain = null;
        this.tremoloLFO = null;
        this.tremoloGain = null;
        
        // Recording
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        
        // State
        this.pitchValue = 50;
        this.volumeValue = 70;
        this.vibratoValue = 0;
        this.tremoloValue = 0;
        this.reverbValue = 0;
        
        // Canvas scope
        this.canvas = document.getElementById('oscilloscope');
        this.ctx = this.canvas.getContext('2d');
        this.drawScope = this.drawScope.bind(this);
        
        this.init();
    }
    
    init() {
        document.addEventListener('click', () => this.start(), { once: true });
        document.addEventListener('touchstart', () => this.start(), { once: true });
        this.setupUI();
        this.showStatus('Tap anywhere to start');
        
        // Force init slider values after DOM settles
        setTimeout(() => {
            const pitchSlider = document.getElementById('pitch-slider');
            const volSlider = document.getElementById('volume-slider');
            
            if (pitchSlider && volSlider) {
                pitchSlider.value = 50;
                volSlider.value = 70;
                this.updatePitch(50);
                this.updateVolume(70);
                console.log('✅ Initial values set');
            }
        }, 100);
    }
    
    async start() {
        if (this.isRunning) return;
        
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.type = 'sine';
            
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 0.7;
            
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
            
            this.oscillator.start();
            
            this.updatePitch(50);
            this.updateVolume(70);
            
            this.isRunning = true;
            this.startScope();
            this.showStatus('Playing - Enjoy!');
        } catch (err) {
            console.error('Audio init error:', err);
            this.showStatus('Error: ' + err.message);
        }
    }
    
    updatePitch(value) {
        this.pitchValue = Number(value);
        if (!this.oscillator || !this.audioCtx) return;
        
        const minFreq = 110;
        const maxFreq = 880;
        const freq = minFreq * Math.pow(maxFreq / minFreq, this.pitchValue / 100);
        
        this.oscillator.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.05);
    }
    
    updateVolume(value) {
        this.volumeValue = Number(value);
        if (!this.gainNode || !this.audioCtx) return;
        
        const gain = this.volumeValue / 100;
        this.gainNode.gain.setTargetAtTime(gain, this.audioCtx.currentTime, 0.05);
    }
    
    updateVibrato(value) {
        this.vibratoValue = Number(value);
        if (!this.audioCtx) return;
        
        if (value > 0 && !this.vibratoLFO) {
            this.vibratoLFO = this.audioCtx.createOscillator();
            this.vibratoLFO.type = 'sine';
            this.vibratoLFO.frequency.value = 5;
            
            this.vibratoGain = this.audioCtx.createGain();
            this.vibratoGain.gain.value = value / 100 * 2;
            
            this.vibratoLFO.connect(this.vibratoGain);
            this.vibratoGain.connect(this.oscillator.frequency);
            this.vibratoLFO.start();
        } else if (value === 0 && this.vibratoLFO) {
            this.vibratoLFO.stop();
            this.vibratoLFO.disconnect();
            this.vibratoLFO = null;
            this.vibratoGain = null;
        } else if (this.vibratoGain) {
            this.vibratoGain.gain.setTargetAtTime(value / 100 * 2, this.audioCtx.currentTime, 0.1);
        }
    }
    
    updateTremolo(value) {
        this.tremoloValue = Number(value);
        if (!this.audioCtx) return;
        
        if (value > 0 && !this.tremoloLFO) {
            this.tremoloLFO = this.audioCtx.createOscillator();
            this.tremoloLFO.type = 'sine';
            this.tremoloLFO.frequency.value = 4;
            
            this.tremoloGain = this.audioCtx.createGain();
            this.tremoloGain.gain.value = value / 100 * 0.15;
            
            this.tremoloLFO.connect(this.tremoloGain);
            this.tremoloGain.connect(this.gainNode.gain);
            this.tremoloLFO.start();
        } else if (value === 0 && this.tremoloLFO) {
            this.tremoloLFO.stop();
            this.tremoloLFO.disconnect();
            this.tremoloLFO = null;
            this.tremoloGain = null;
        } else if (this.tremoloGain) {
            this.tremoloGain.gain.setTargetAtTime(value / 100 * 0.15, this.audioCtx.currentTime, 0.1);
        }
    }
    
    updateReverb(value) {
        this.reverbValue = Number(value);
        console.log('Reverb set to:', value);
    }
    
    startScope() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            if (!this.isRunning) return;
            requestAnimationFrame(animate);
            this.analyser.getByteTimeDomainData(dataArray);
            this.drawScope(dataArray, bufferLength);
        };
        
        animate();
    }
    
    drawScope(dataArray, bufferLength) {
        const rect = this.canvas.getBoundingClientRect();
        if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = 'rgba(26, 26, 46, 0.2)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#6d4aff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#6d4aff';
        
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    toggleRecording() {
        if (!this.isRunning) return;
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    startRecording() {
        const stream = this.audioCtx.createMediaStreamDestination();
        this.oscillator.connect(stream);
        this.mediaRecorder = new MediaRecorder(stream.stream);
        this.audioChunks = [];
        
        this.mediaRecorder.ondataavailable = (e) => {
            this.audioChunks.push(e.data);
        };
        
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vibrolux-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            this.showStatus('Saved!');
        };
        
        this.mediaRecorder.start();
        this.isRecording = true;
        document.getElementById('record-btn').classList.add('recording');
        this.showStatus('Recording... tap REC to stop');
    }
    
    stopRecording() {
        if (!this.mediaRecorder) return;
        this.mediaRecorder.stop();
        this.isRecording = false;
        document.getElementById('record-btn').classList.remove('recording');
    }
    
    showStatus(msg) {
        const el = document.getElementById('status-message');
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 3000);
    }
    
    setupUI() {
        // Sliders
        document.getElementById('pitch-slider').addEventListener('input', (e) => {
            this.updatePitch(Number(e.target.value));
        });
        
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.updateVolume(Number(e.target.value));
        });
        
        // Knobs
        this.setupKnob('vibrato-knob', (val) => this.updateVibrato(val));
        this.setupKnob('tremolo-knob', (val) => this.updateTremolo(val));
        this.setupKnob('reverb-knob', (val) => this.updateReverb(val));
        
        // Record button
        document.getElementById('record-btn').addEventListener('click', () => {
            this.toggleRecording();
        });
    }
    
    setupKnob(id, callback) {
        const knob = document.getElementById(id);
        if (!knob) {
            console.error(`${id} NOT FOUND!`);
            return;
        }
        
        let isDragging = false;
        let startY = 0;
        let startValue = 0;
        
        const updateRotation = (val) => {
            const rotation = -135 + (val / 100) * 270;
            const indicator = document.getElementById(id.replace('-knob', '-indicator'));
            if (indicator) {
                indicator.style.transformOrigin = 'center';
                indicator.style.transform = `rotate(${rotation}deg)`;
            }
        };
        
        knob.dataset.value = '0';
        updateRotation(0);
        
        knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startValue = parseInt(knob.dataset.value, 10) || 0;
            e.preventDefault();
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            let newValue = startValue + deltaY;
            newValue = Math.max(0, Math.min(100, newValue));
            knob.dataset.value = newValue.toString();
            updateRotation(newValue);
            callback(newValue);
        });
        
        window.addEventListener('mouseup', () => { isDragging = false; });
        
        knob.addEventListener('touchstart', (e) => {
            isDragging = true;
            startY = e.touches[0].clientY;
            startValue = parseInt(knob.dataset.value, 10) || 0;
            e.preventDefault();
        }, { passive: false });
        
        knob.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaY = startY - e.touches[0].clientY;
            let newValue = startValue + deltaY;
            newValue = Math.max(0, Math.min(100, newValue));
            knob.dataset.value = newValue.toString();
            updateRotation(newValue);
            callback(newValue);
        }, { passive: false });
        
        knob.addEventListener('touchend', () => { isDragging = false; });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.vibrolux = new VibroluxEngine();
});