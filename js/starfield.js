// ==================== Starfield Animation ====================
// 柔和的星空穿梭效果 - 向前流动的星光

(function() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let width, height, centerX, centerY;
    let stars = [];

    // 配置 - 更柔和的参数
    const config = {
        starCount: 80,             // 减少星星数量
        speed: 0.5,                // 降低速度
        starColor: '200, 220, 255', // 淡蓝色星星
    };

    // 星星类
    class Star {
        constructor() {
            this.init(true);
        }

        init(initial = false) {
            this.x = (Math.random() - 0.5) * width * 2;
            this.y = (Math.random() - 0.5) * height * 2;
            this.z = initial ? Math.random() * 1000 : 1000;
            this.size = Math.random() * 1.5 + 0.5;
        }

        update() {
            this.z -= config.speed * 15;
            if (this.z <= 0) {
                this.init();
            }
        }

        draw() {
            const scale = 300 / this.z;
            const x = centerX + this.x * scale;
            const y = centerY + this.y * scale;
            const size = this.size * scale;
            const opacity = (1 - this.z / 1000) * 0.6;

            if (x < 0 || x > width || y < 0 || y > height || opacity <= 0) return;

            // 简单的星星点
            ctx.fillStyle = `rgba(${config.starColor}, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(size, 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 流萤 - 更少更暗
    class Firefly {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3 - 0.2;
            this.opacity = 0;
            this.fadeIn = true;
            this.maxOpacity = Math.random() * 0.3 + 0.1;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // 淡入淡出
            if (this.fadeIn) {
                this.opacity += 0.005;
                if (this.opacity >= this.maxOpacity) {
                    this.fadeIn = false;
                }
            } else {
                this.opacity -= 0.003;
                if (this.opacity <= 0) {
                    this.init();
                }
            }

            // 边界检查
            if (this.x < -50 || this.x > width + 50 || this.y < -50 || this.y > height + 50) {
                this.init();
            }
        }

        draw() {
            if (this.opacity <= 0) return;

            // 柔和的光晕
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
            gradient.addColorStop(0, `rgba(150, 180, 255, ${this.opacity})`);
            gradient.addColorStop(1, `rgba(150, 180, 255, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
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

        // 创建流萤 - 数量减少
        fireflies = [];
        for (let i = 0; i < 15; i++) {
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
        // 清除画布 - 使用深色背景
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
