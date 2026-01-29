// ==================== Starfield Animation ====================
// 星空穿梭效果 - 向前流动的星光

(function() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // 配置
    const config = {
        starCount: 200,           // 星星数量
        speed: 2,                 // 飞行速度
        trailLength: 0.3,         // 拖尾长度 (0-1)
        starColor: '255, 255, 255', // 星星颜色 RGB
        bgColor: '6, 11, 25',      // 背景颜色 RGB (深蓝黑)
        twinkle: true,            // 是否闪烁
        glow: true,               // 是否发光
        glowColor: '100, 180, 255' // 发光颜色 (淡蓝)
    };

    let width, height, centerX, centerY;
    let stars = [];

    // 星星类
    class Star {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            // 随机位置（以中心为原点的极坐标）
            this.angle = Math.random() * Math.PI * 2;
            this.distance = initial ? Math.random() * Math.max(width, height) : 0;
            this.z = Math.random() * 1000 + 500; // 深度
            this.size = Math.random() * 1.5 + 0.5;
            this.opacity = Math.random() * 0.5 + 0.5;
            this.twinkleSpeed = Math.random() * 0.02 + 0.01;
            this.twinklePhase = Math.random() * Math.PI * 2;
        }

        update() {
            // 向前移动（z 减小 = 靠近观察者）
            this.z -= config.speed * 10;

            // 闪烁效果
            if (config.twinkle) {
                this.twinklePhase += this.twinkleSpeed;
                this.currentOpacity = this.opacity * (0.7 + Math.sin(this.twinklePhase) * 0.3);
            } else {
                this.currentOpacity = this.opacity;
            }

            // 重置超出范围的星星
            if (this.z <= 0) {
                this.reset();
            }
        }

        draw() {
            // 3D 投影到 2D
            const perspective = 300;
            const scale = perspective / this.z;

            const x = centerX + Math.cos(this.angle) * this.distance * scale;
            const y = centerY + Math.sin(this.angle) * this.distance * scale;
            const size = this.size * scale * 2;
            const opacity = this.currentOpacity * (1 - this.z / 1500);

            if (opacity <= 0 || x < 0 || x > width || y < 0 || y > height) return;

            // 绘制光晕
            if (config.glow && size > 1) {
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
                gradient.addColorStop(0, `rgba(${config.glowColor}, ${opacity * 0.3})`);
                gradient.addColorStop(1, `rgba(${config.glowColor}, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, size * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // 绘制星星
            ctx.fillStyle = `rgba(${config.starColor}, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // 绘制拖尾（运动模糊效果）
            if (config.trailLength > 0 && size > 0.5) {
                const trailLength = Math.min(size * 8, 50);
                const fromCenterAngle = Math.atan2(y - centerY, x - centerX);

                const gradient = ctx.createLinearGradient(
                    x - Math.cos(fromCenterAngle) * trailLength,
                    y - Math.sin(fromCenterAngle) * trailLength,
                    x, y
                );
                gradient.addColorStop(0, `rgba(${config.starColor}, 0)`);
                gradient.addColorStop(1, `rgba(${config.starColor}, ${opacity * config.trailLength})`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = size * 0.8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x - Math.cos(fromCenterAngle) * trailLength, y - Math.sin(fromCenterAngle) * trailLength);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    }

    // 流萤效果（额外的光点）
    class Firefly {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5 - 0.3; // 稍微向上
            this.life = Math.random() * 200 + 100;
            this.maxLife = this.life;
            this.hue = Math.random() * 60 + 180; // 蓝色到紫色
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life--;

            if (this.life <= 0 || this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
                this.reset();
            }
        }

        draw() {
            const opacity = (this.life / this.maxLife) * 0.6;
            const pulse = Math.sin(Date.now() * 0.005 + this.x) * 0.3 + 0.7;

            // 光晕
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
            gradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, ${opacity * pulse})`);
            gradient.addColorStop(0.5, `hsla(${this.hue}, 100%, 50%, ${opacity * pulse * 0.5})`);
            gradient.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
            ctx.fill();

            // 核心
            ctx.fillStyle = `hsla(${this.hue}, 100%, 90%, ${opacity * pulse})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let fireflies = [];

    // 初始化
    function init() {
        resize();
        window.addEventListener('resize', resize);

        // 创建星星
        stars = [];
        for (let i = 0; i < config.starCount; i++) {
            stars.push(new Star());
        }

        // 创建流萤
        fireflies = [];
        for (let i = 0; i < 30; i++) {
            fireflies.push(new Firefly());
        }

        animate();
    }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        centerX = width / 2;
        centerY = height / 2;
    }

    // 动画循环
    function animate() {
        // 清除画布（带拖尾效果）
        ctx.fillStyle = `rgba(${config.bgColor}, 0.2)`;
        ctx.fillRect(0, 0, width, height);

        // 绘制星星
        stars.forEach(star => {
            star.update();
            star.draw();
        });

        // 绘制流萤
        fireflies.forEach(firefly => {
            firefly.update();
            firefly.draw();
        });

        requestAnimationFrame(animate);
    }

    // 启动
    init();

})();
