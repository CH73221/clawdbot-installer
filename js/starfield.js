// ==================== Starfield Animation ====================
// 星空穿梭效果 - 充满发光微粒的穿梭感

(function() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let width, height, centerX, centerY;
    let stars = [];

    // 配置
    const config = {
        starCount: 300,           // 大量星星
        speed: 0.8,               // 适中的速度
        starColor: '180, 200, 255', // 淡蓝白色
    };

    class Star {
        constructor() {
            this.init(true);
        }

        init(initial = false) {
            // 随机分布在整个空间
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * Math.max(width, height);
            this.x = Math.cos(angle) * distance;
            this.y = Math.sin(angle) * distance;
            this.z = initial ? Math.random() * 1500 : 1500;
            this.baseSize = Math.random() * 2 + 0.5;
            this.brightness = Math.random() * 0.5 + 0.5;
        }

        update() {
            this.z -= config.speed * 20;
            if (this.z <= 0) {
                this.init();
            }
        }

        draw() {
            const scale = 400 / this.z;
            const x = centerX + this.x * scale;
            const y = centerY + this.y * scale;
            const size = this.baseSize * scale;
            const opacity = this.brightness * (1 - this.z / 1500) * 0.8;

            if (x < -10 || x > width + 10 || y < -10 || y > height + 10 || opacity <= 0.01) return;

            // 星星核心
            ctx.fillStyle = `rgba(${config.starColor}, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(size * 0.3, 0.5), 0, Math.PI * 2);
            ctx.fill();

            // 外发光（柔和）
            if (size > 1) {
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
                gradient.addColorStop(0, `rgba(${config.starColor}, ${opacity * 0.3})`);
                gradient.addColorStop(1, `rgba(${config.starColor}, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 流萤 - 更多更亮
    class Firefly {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4 - 0.3;
            this.opacity = 0;
            this.fadeIn = true;
            this.maxOpacity = Math.random() * 0.4 + 0.2;
            this.hue = Math.random() * 40 + 190; // 蓝色到青色
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // 淡入淡出循环
            if (this.fadeIn) {
                this.opacity += 0.008;
                if (this.opacity >= this.maxOpacity) {
                    this.fadeIn = false;
                }
            } else {
                this.opacity -= 0.004;
                if (this.opacity <= 0) {
                    this.init();
                }
            }

            if (this.x < -50 || this.x > width + 50 || this.y < -50 || this.y > height + 50) {
                this.init();
            }
        }

        draw() {
            if (this.opacity <= 0) return;

            // 光晕
            const glowSize = this.size * 4;
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
            gradient.addColorStop(0, `hsla(${this.hue}, 80%, 70%, ${this.opacity * 0.8})`);
            gradient.addColorStop(0.5, `hsla(${this.hue}, 80%, 50%, ${this.opacity * 0.3})`);
            gradient.addColorStop(1, `hsla(${this.hue}, 80%, 50%, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
            ctx.fill();

            // 核心
            ctx.fillStyle = `hsla(${this.hue}, 100%, 90%, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let fireflies = [];

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
        for (let i = 0; i < 40; i++) {
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

    function animate() {
        // 深色背景
        ctx.fillStyle = 'rgb(6, 11, 25)';
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

    init();
})();
