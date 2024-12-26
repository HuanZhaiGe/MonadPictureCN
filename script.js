class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.selectedLogo = null;
        this.baseImage = null;
        
        // 修改为存储多个logo的数组
        this.logos = [];
        this.selectedLogoIndex = -1;
        
        // Logo属性模板
        this.defaultLogoState = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            opacity: 1,
            isDragging: false,
            isResizing: false,
            dragStartX: 0,
            dragStartY: 0,
            originalX: 0,
            originalY: 0,
            originalWidth: 0,
            originalHeight: 0,
            rotation: 0,
            isFlippedX: false,
            isFlippedY: false
        };
        
        // 添加新的属性
        this.removeLogo = document.getElementById('removeLogo');
        this.logoSizeSlider = document.getElementById('logoSizeSlider');
        
        // 创建缓冲画布
        this.bufferCanvas = document.createElement('canvas');
        this.bufferCtx = this.bufferCanvas.getContext('2d');
        
        // 用于存储基础图像的画布
        this.baseCanvas = document.createElement('canvas');
        this.baseCtx = this.baseCanvas.getContext('2d');
        
        // 添加最大文件大小限制（500KB）
        this.MAX_FILE_SIZE = 500 * 1024;
        
        // 添加删除图片按钮引用
        this.removeImageBtn = document.getElementById('removeImage');
        this.canvasContainer = document.querySelector('.canvas-container');
        
        // 初始状态隐藏画布
        this.canvasContainer.classList.add('hidden');
        
        // 添加画布设置相关属性
        this.canvasWidth = document.getElementById('canvasWidth');
        this.canvasHeight = document.getElementById('canvasHeight');
        this.canvasColor = document.getElementById('canvasColor');
        this.createCanvasBtn = document.getElementById('createCanvas');
        
        // 添加键盘事件监听器
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedLogo) {
                this.selectedLogo = null;
                this.removeLogo.disabled = true;
                this.drawImage();
            }
        });
        
        // 修改默认画布尺寸
        this.defaultWidth = 1080;
        this.defaultHeight = 1080;
        
        // 更新输入框的默认值
        this.canvasWidth.value = this.defaultWidth;
        this.canvasHeight.value = this.defaultHeight;
        
        // 初始化默认画布
        this.initializeDefaultCanvas();
        
        // 添加标记是否有自定义背景
        this.hasCustomBackground = false;
        
        // 初始化滑块值和样式
        const opacitySlider = document.getElementById('logoOpacity');
        const sizeSlider = document.getElementById('logoSizeSlider');
        
        // 设置透明度滑块的初始值
        opacitySlider.value = 100;
        const opacityContainer = opacitySlider.closest('.range-container');
        opacityContainer.style.setProperty('--value', '100%');
        
        // 设置大小滑块的初始值
        sizeSlider.value = 20;
        const sizeContainer = sizeSlider.closest('.range-container');
        sizeContainer.style.setProperty('--value', '20%');
        
        // 初始化事件监听器（只调用一次）
        this.initializeEventListeners();
        
        // 初始化旋转和翻转按钮
        this.initializeRotateFlipControls();
    }
    
    initializeEventListeners() {
        // 修改图片上传处理
        const imageInput = document.getElementById('imageInput');
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                this.showLoadingMessage('正在处理图片...');
                
                if (file.size > this.MAX_FILE_SIZE) {
                    console.log(`图片大小(${(file.size/1024).toFixed(2)}KB)超过限制，进行压缩...`);
                    const compressedDataUrl = await this.compressImage(file);
                    await this.loadImage(compressedDataUrl);
                } else {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        await this.loadImage(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            } catch (error) {
                console.error('图片处理失败:', error);
                this.showErrorMessage('图片处理失败，请重试');
            } finally {
                this.hideLoadingMessage();
                imageInput.value = '';
            }
        });
        
        // Logo选择处理
        document.querySelectorAll('.logo-item').forEach(logo => {
            // 移除旧的事件监听器
            logo.removeEventListener('click', this.handleLogoClick);
            // 添加新的事件监听器
            logo.addEventListener('click', this.handleLogoClick.bind(this));
        });
        
        // 添加预设画布按钮事件监听
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);
                this.canvasWidth.value = width;
                this.canvasHeight.value = height;
                this.createCustomCanvas();
            });
        });
        
        // 添加预设背景点击事件
        document.querySelectorAll('.preset-background').forEach(bg => {
            bg.addEventListener('click', () => {
                const imgSrc = bg.dataset.src;
                this.loadPresetBackground(imgSrc);
            });
        });
        
        // 添加画布点击事件
        this.canvas.addEventListener('click', (e) => {
            if (!this.baseImage && !this.hasCustomBackground) {
                document.getElementById('imageInput').click();
            }
        });
        
        // 添加鼠标悬停效果
        this.canvas.addEventListener('mouseover', () => {
            if (!this.baseImage && !this.hasCustomBackground) {
                this.canvas.style.cursor = 'pointer';
            }
        });
        
        this.canvas.addEventListener('mouseout', () => {
            if (!this.baseImage && !this.hasCustomBackground) {
                this.canvas.style.cursor = 'default';
            }
        });
        
        // 透明度控制
        const opacitySlider = document.getElementById('logoOpacity');
        opacitySlider.addEventListener('input', (e) => {
            if (this.selectedLogoIndex < 0) return;
            
            const value = e.target.value;
            this.logos[this.selectedLogoIndex].state.opacity = value / 100;
            const container = e.target.closest('.range-container');
            container.style.setProperty('--value', `${value}%`);
            this.drawImage();
        });
        
        // 大小控制
        this.logoSizeSlider.addEventListener('input', (e) => {
            if (this.selectedLogoIndex < 0) return;
            
            const value = e.target.value;
            const container = e.target.closest('.range-container');
            container.style.setProperty('--value', `${value}%`);
            
            const logo = this.logos[this.selectedLogoIndex];
            const newWidth = (this.canvas.width * value) / 100;
            const ratio = newWidth / logo.state.width;
            
            const centerX = logo.state.x + logo.state.width / 2;
            const centerY = logo.state.y + logo.state.height / 2;
            
            logo.state.width = newWidth;
            logo.state.height = logo.state.height * ratio;
            
            logo.state.x = centerX - logo.state.width / 2;
            logo.state.y = centerY - logo.state.height / 2;
            
            this.drawImage();
        });
        
        // 初始化滑块样式
        opacitySlider.style.setProperty('--value', '100%');
        this.logoSizeSlider.style.setProperty('--value', '20%');
        
        // 删除旧的事件监听器
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        
        // 添加新的鼠标事件处理
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX + window.scrollX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY + window.scrollY - rect.top) * (this.canvas.height / rect.height);
            
            // 检查点击是否在任何logo上
            for (let i = this.logos.length - 1; i >= 0; i--) {
                const logo = this.logos[i];
                if (this.isInDragZone(x, y, logo.state)) {
                    this.selectedLogoIndex = i;
                    const state = logo.state;
                    
                    if (e.shiftKey && this.isInResizeZone(x, y, state)) {
                        state.isResizing = true;
                        this.canvas.style.cursor = 'se-resize';
                    } else {
                        state.isDragging = true;
                        this.canvas.style.cursor = 'move';
                    }
                    
                    state.dragStartX = x;
                    state.dragStartY = y;
                    state.originalX = state.x;
                    state.originalY = state.y;
                    state.originalWidth = state.width;
                    state.originalHeight = state.height;
                    
                    // 更新控制面板
                    const opacitySlider = document.getElementById('logoOpacity');
                    opacitySlider.value = state.opacity * 100;
                    const opacityContainer = opacitySlider.closest('.range-container');
                    opacityContainer.style.setProperty('--value', `${state.opacity * 100}%`);
                    
                    const sizePercent = (state.width / this.canvas.width) * 100;
                    this.logoSizeSlider.value = sizePercent;
                    const sizeContainer = this.logoSizeSlider.closest('.range-container');
                    sizeContainer.style.setProperty('--value', `${sizePercent}%`);
                    
                    break;
                }
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.selectedLogoIndex < 0) {
                this.canvas.style.cursor = 'default';
                return;
            }
            
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX + window.scrollX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY + window.scrollY - rect.top) * (this.canvas.height / rect.height);
            
            const logo = this.logos[this.selectedLogoIndex];
            
            if (logo.state.isResizing) {
                const deltaX = x - logo.state.dragStartX;
                const scale = (logo.state.originalWidth + deltaX) / logo.state.originalWidth;
                logo.state.width = logo.state.originalWidth * scale;
                logo.state.height = logo.state.originalHeight * scale;
                
                // 更新大小滑块
                const sizePercent = (logo.state.width / this.canvas.width) * 100;
                this.logoSizeSlider.value = sizePercent;
                const sizeContainer = this.logoSizeSlider.closest('.range-container');
                sizeContainer.style.setProperty('--value', `${sizePercent}%`);
                
                this.drawImage();
            } else if (logo.state.isDragging) {
                const deltaX = x - logo.state.dragStartX;
                const deltaY = y - logo.state.dragStartY;
                
                logo.state.x = logo.state.originalX + deltaX;
                logo.state.y = logo.state.originalY + deltaY;
                
                this.drawImage();
            } else {
                // 更新鼠标样式
                if (e.shiftKey && this.isInResizeZone(x, y, logo.state)) {
                    this.canvas.style.cursor = 'se-resize';
                } else if (this.isInDragZone(x, y, logo.state)) {
                    this.canvas.style.cursor = 'move';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            if (this.selectedLogoIndex >= 0) {
                const logo = this.logos[this.selectedLogoIndex];
                logo.state.isDragging = false;
                logo.state.isResizing = false;
            }
            this.canvas.style.cursor = 'default';
        });
        
        // 下载按钮处理
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadImage();
        });
        
        // 添加大小控制监听器
        this.logoSizeSlider.addEventListener('input', (e) => {
            if (!this.selectedLogo) return;
            
            const newSize = parseInt(e.target.value);
            document.getElementById('sizeValue').textContent = newSize + '%';
            
            // 计算新的尺寸
            const newWidth = (this.canvas.width * newSize) / 100;
            const ratio = newWidth / this.logoState.width;
            
            // 保持logo中心点不变
            const centerX = this.logoState.x + this.logoState.width / 2;
            const centerY = this.logoState.y + this.logoState.height / 2;
            
            this.logoState.width = newWidth;
            this.logoState.height = this.logoState.height * ratio;
            
            // 更新位置以保持居中
            this.logoState.x = centerX - this.logoState.width / 2;
            this.logoState.y = centerY - this.logoState.height / 2;
            
            this.drawImage();
        });
        
        // 添加删除按钮监听器
        this.removeLogo.addEventListener('click', () => {
            if (this.selectedLogoIndex >= 0) {
                this.logos.splice(this.selectedLogoIndex, 1);
                this.selectedLogoIndex = this.logos.length - 1;
                this.removeLogo.disabled = this.logos.length === 0;
                this.drawImage();
            }
        });
        
        // 添加删除图片按钮事件监听器
        this.removeImageBtn.addEventListener('click', () => {
            this.removeImage();
        });
        
        // 添加创建画布按钮事件监听器
        this.createCanvasBtn.addEventListener('click', () => {
            this.createCustomCanvas();
        });
        
        // 添加键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (this.selectedLogoIndex >= 0) {
                switch(e.key) {
                    case 'r':  // 向右旋转90度
                        this.rotateLogo(90);
                        break;
                    case 'R':  // 向左旋转90度
                        this.rotateLogo(-90);
                        break;
                    case 'h':  // 水平翻转
                        this.flipLogo('horizontal');
                        break;
                    case 'v':  // 垂直翻转
                        this.flipLogo('vertical');
                        break;
                    case 'Delete':
                    case 'Backspace':
                        this.logos.splice(this.selectedLogoIndex, 1);
                        this.selectedLogoIndex = this.logos.length - 1;
                        this.removeLogo.disabled = this.logos.length === 0;
                        this.drawImage();
                        break;
                }
            }
        });
    }
    
    initializeLogo() {
        if (!this.baseImage || !this.selectedLogo) return;
        
        // 初始化Logo位置和大小
        const defaultWidth = this.canvas.width * 0.2;
        const ratio = defaultWidth / this.selectedLogo.width;
        
        this.logoState = {
            ...this.logoState,
            x: (this.canvas.width - defaultWidth) / 2,
            y: (this.canvas.height - this.selectedLogo.height * ratio) / 2,
            width: defaultWidth,
            height: this.selectedLogo.height * ratio,
            opacity: 1  // 设初始不透明度为1（100%）
        };
        
        // 启用删除按钮
        this.removeLogo.disabled = false;
        
        // 重置滑块值
        this.logoSizeSlider.value = 20;
        document.getElementById('sizeValue').textContent = '20%';
        
        // 设置透明度滑块的值和样式
        const opacitySlider = document.getElementById('logoOpacity');
        opacitySlider.value = 100;
        const opacityContainer = opacitySlider.closest('.range-container');
        opacityContainer.style.setProperty('--value', '100%');
        
        this.drawImage();
    }
    
    isInResizeZone(x, y, state) {
        const resizeHandleSize = 20 * (this.canvas.width / this.canvas.clientWidth);
        return (
            x >= state.x + state.width - resizeHandleSize &&
            x <= state.x + state.width &&
            y >= state.y + state.height - resizeHandleSize &&
            y <= state.y + state.height
        );
    }
    
    isInDragZone(x, y, state) {
        return (
            x >= state.x &&
            x <= state.x + state.width &&
            y >= state.y &&
            y <= state.y + state.height
        );
    }
    
    handleMouseDown(e) {
        if (!this.selectedLogo) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // 计算鼠标在canvas中的实际位置，考虑滚动位置
        const x = (e.clientX + window.scrollX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY + window.scrollY - rect.top) * (this.canvas.height / rect.height);
        
        if (e.shiftKey && this.isInResizeZone(x, y, state)) {
            this.logoState.isResizing = true;
            this.canvas.style.cursor = 'se-resize';
        } else if (this.isInDragZone(x, y)) {
            this.logoState.isDragging = true;
            this.canvas.style.cursor = 'move';
        }
        
        this.logoState.dragStartX = x;
        this.logoState.dragStartY = y;
        this.logoState.originalX = this.logoState.x;
        this.logoState.originalY = this.logoState.y;
        this.logoState.originalWidth = this.logoState.width;
        this.logoState.originalHeight = this.logoState.height;
    }
    
    handleMouseMove(e) {
        if (!this.selectedLogo) {
            this.canvas.style.cursor = 'default';
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        // 计算鼠标在canvas的实际位置，考虑滚动位置
        const x = (e.clientX + window.scrollX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY + window.scrollY - rect.top) * (this.canvas.height / rect.height);
        
        if (this.logoState.isResizing) {
            const deltaX = x - this.logoState.dragStartX;
            const scale = (this.logoState.originalWidth + deltaX) / this.logoState.originalWidth;
            this.logoState.width = this.logoState.originalWidth * scale;
            this.logoState.height = this.logoState.originalHeight * scale;
            this.drawImage();
        } else if (this.logoState.isDragging) {
            const deltaX = x - this.logoState.dragStartX;
            const deltaY = y - this.logoState.dragStartY;
            
            // 直接设置新位置，不进行边界检查
            this.logoState.x = this.logoState.originalX + deltaX;
            this.logoState.y = this.logoState.originalY + deltaY;
            
            this.drawImage();
        } else {
            // 更新鼠标样式
            if (e.shiftKey && this.isInResizeZone(x, y)) {
                this.canvas.style.cursor = 'se-resize';
            } else if (this.isInDragZone(x, y)) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    handleMouseUp() {
        this.logoState.isDragging = false;
        this.logoState.isResizing = false;
        this.canvas.style.cursor = 'default';
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // 更新画布设置输入框的值
                this.canvasWidth.value = img.width;
                this.canvasHeight.value = img.height;
                
                // 设置画布尺寸
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.bufferCanvas.width = img.width;
                this.bufferCanvas.height = img.height;
                this.baseCanvas.width = img.width;
                this.baseCanvas.height = img.height;
                
                // 将原始图像绘制到基础画布上
                this.baseCtx.drawImage(img, 0, 0);
                this.baseImage = img;
                
                // 显示画布容器
                this.canvasContainer.classList.remove('hidden');
                
                // 启用删除图片按钮
                this.removeImageBtn.disabled = false;
                
                // 移除空白状态
                this.canvasContainer.classList.remove('empty');
                
                this.drawImage();
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }
    
    drawImage() {
        // 清除缓冲画布
        this.bufferCtx.clearRect(0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
        
        // 如果有基础图像，绘制它
        if (this.baseImage) {
            this.bufferCtx.drawImage(this.baseImage, 0, 0);
        } else {
            // 如果没有基础图像，使用当前设置的背景颜色
            this.bufferCtx.fillStyle = this.canvasColor.value;
            this.bufferCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // 绘制所有logo
        this.logos.forEach((logo, index) => {
            this.bufferCtx.save();
            
            // 设置透明度
            this.bufferCtx.globalAlpha = logo.state.opacity;
            
            // 添加阴影效果
            this.bufferCtx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            this.bufferCtx.shadowBlur = 5;
            this.bufferCtx.shadowOffsetX = 1;
            this.bufferCtx.shadowOffsetY = 1;
            
            // 移动到logo中心点
            const centerX = logo.state.x + logo.state.width / 2;
            const centerY = logo.state.y + logo.state.height / 2;
            this.bufferCtx.translate(centerX, centerY);
            
            // 应用旋转
            this.bufferCtx.rotate(logo.state.rotation * Math.PI / 180);
            
            // 应用翻转
            this.bufferCtx.scale(
                logo.state.isFlippedX ? -1 : 1,
                logo.state.isFlippedY ? -1 : 1
            );
            
            // 绘制logo
            this.bufferCtx.drawImage(
                logo.image,
                -logo.state.width / 2,
                -logo.state.height / 2,
                logo.state.width,
                logo.state.height
            );
            
            this.bufferCtx.restore();
        });
        
        // 将缓冲画布的内容复制到主画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.bufferCanvas, 0, 0);
    }
    
    // 计算图像区域的平均颜色
    getAverageColor(imageData) {
        let r = 0, g = 0, b = 0, count = 0;
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) { // 只计算非透明像素
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
        }
        
        return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count)
        };
    }
    
    downloadImage() {
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }
    
    // 添加压缩图片的方法
    compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // 创建临时画布用于压缩
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    
                    // 如果图片太大，按比例缩小
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1080;
                    
                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width *= ratio;
                        height *= ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 尝试不同的质量级别进行压缩
                    let quality = 0.9;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    
                    // 如果文件仍然太大，继续降低质量
                    while (dataUrl.length > this.MAX_FILE_SIZE * 1.37 && quality > 0.1) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
                    
                    resolve(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    // 添加提示消息相关方法
    showLoadingMessage(message) {
        let loadingDiv = document.getElementById('loadingMessage');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'loadingMessage';
            loadingDiv.className = 'message-overlay';
            document.body.appendChild(loadingDiv);
        }
        loadingDiv.textContent = message;
        loadingDiv.style.display = 'flex';
    }
    
    hideLoadingMessage() {
        const loadingDiv = document.getElementById('loadingMessage');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }
    
    showErrorMessage(message) {
        alert(message); // 简单起见用alert，你也可以用更优雅的提示方式
    }
    
    // 添加删除图片的方法
    removeImage() {
        // 清除图片相关数据
        this.baseImage = null;
        this.selectedLogo = null;
        
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.bufferCtx.clearRect(0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
        this.baseCtx.clearRect(0, 0, this.baseCanvas.width, this.baseCanvas.height);
        
        // 重置画布尺寸
        this.canvas.width = 0;
        this.canvas.height = 0;
        this.bufferCanvas.width = 0;
        this.bufferCanvas.height = 0;
        this.baseCanvas.width = 0;
        this.baseCanvas.height = 0;
        
        // 禁用相关按钮
        this.removeImageBtn.disabled = true;
        this.removeLogo.disabled = true;
        
        // 隐藏画布容器
        this.canvasContainer.classList.add('hidden');
        
        // 重置文件输入
        document.getElementById('imageInput').value = '';
        
        // 重置画布设置输入框为默认值
        this.canvasWidth.value = '1080';
        this.canvasHeight.value = '1080';
        this.canvasColor.value = '#ffffff';
        
        // 重置后显示默认画布
        this.initializeDefaultCanvas();
        
        // 重置自定义背景标记
        this.hasCustomBackground = false;
    }
    
    createCustomCanvas() {
        const width = parseInt(this.canvasWidth.value);
        const height = parseInt(this.canvasHeight.value);
        
        // 验证输入
        if (width < 100 || width > 3000 || height < 100 || height > 3000) {
            this.showErrorMessage('画布尺寸必须在100-3000像素之间');
            return;
        }
        
        // 设置画布尺寸
        this.canvas.width = width;
        this.canvas.height = height;
        this.bufferCanvas.width = width;
        this.bufferCanvas.height = height;
        this.baseCanvas.width = width;
        this.baseCanvas.height = height;
        
        // 使用选择的颜色填充背景
        const backgroundColor = this.canvasColor.value;
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        this.bufferCtx.fillStyle = backgroundColor;
        this.bufferCtx.fillRect(0, 0, width, height);
        this.baseCtx.fillStyle = backgroundColor;
        this.baseCtx.fillRect(0, 0, width, height);
        
        // 创建基础图像
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, width, height);
        
        // 创建并设置基础图像
        this.baseImage = new Image();
        this.baseImage.src = tempCanvas.toDataURL();
        
        // 显示画布容器
        this.canvasContainer.classList.remove('hidden');
        this.canvasContainer.classList.remove('empty');
        
        // 启用删除图片按钮
        this.removeImageBtn.disabled = false;
        
        // 清除任何现有logo
        this.selectedLogo = null;
        this.removeLogo.disabled = true;
        
        // 标记为自定义背景
        this.hasCustomBackground = true;
        
        // 重绘画布
        this.drawImage();
    }
    
    // 添加加载预设背景的方法
    loadPresetBackground(src) {
        const img = new Image();
        img.onload = () => {
            // 保持原始尺寸
            this.canvasWidth.value = img.width;
            this.canvasHeight.value = img.height;
            
            // 创建画布并设置背景
            this.createCustomCanvas();
            
            // 绘制背景图
            this.baseCtx.drawImage(img, 0, 0);
            this.baseImage = img;
            
            // 移除空白状态
            this.canvasContainer.classList.remove('empty');
            
            // 重绘画布
            this.drawImage();
        };
        img.src = src;
    }
    
    // 添加初始化默认画布的方法
    initializeDefaultCanvas() {
        // 设置画布尺寸
        this.canvas.width = this.defaultWidth;
        this.canvas.height = this.defaultHeight;
        this.bufferCanvas.width = this.defaultWidth;
        this.bufferCanvas.height = this.defaultHeight;
        this.baseCanvas.width = this.defaultWidth;
        this.baseCanvas.height = this.defaultHeight;
        
        // 使用默认颜色填充背景
        const backgroundColor = this.canvasColor.value;
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, this.defaultWidth, this.defaultHeight);
        this.bufferCtx.fillStyle = backgroundColor;
        this.bufferCtx.fillRect(0, 0, this.defaultWidth, this.defaultHeight);
        this.baseCtx.fillStyle = backgroundColor;
        this.baseCtx.fillRect(0, 0, this.defaultWidth, this.defaultHeight);
        
        // 不创建基础图像，保持为null
        this.baseImage = null;
        
        // 显示画布容器
        this.canvasContainer.classList.remove('hidden');
        
        // 启用删除图片按钮
        this.removeImageBtn.disabled = false;
        
        // 重绘画布
        this.drawImage();
        
        // 添加空白状态类
        this.canvasContainer.classList.add('empty');
        
        // 重置自定义背景标记
        this.hasCustomBackground = false;
    }
    
    // 添加旋转logo的方法
    rotateLogo(degrees) {
        if (this.selectedLogoIndex >= 0) {
            console.log('Rotating logo by', degrees, 'degrees');
            const logo = this.logos[this.selectedLogoIndex];
            logo.state.rotation = (logo.state.rotation + degrees) % 360;
            this.drawImage();
        }
    }
    
    // 添加翻转logo的方法
    flipLogo(direction) {
        if (this.selectedLogoIndex >= 0) {
            console.log('Flipping logo', direction);
            const logo = this.logos[this.selectedLogoIndex];
            if (direction === 'horizontal') {
                logo.state.isFlippedX = !logo.state.isFlippedX;
            } else if (direction === 'vertical') {
                logo.state.isFlippedY = !logo.state.isFlippedY;
            }
            this.drawImage();
        }
    }
    
    initializeRotateFlipControls() {
        // 绑定旋转和翻转按钮事件
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        const flipHorizontalBtn = document.getElementById('flipHorizontalBtn');
        const flipVerticalBtn = document.getElementById('flipVerticalBtn');
        const rotateAngleInput = document.getElementById('rotateAngle');
        
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => {
                console.log('Rotating left');
                this.rotateLogo(-90);
            });
        }
        
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => {
                console.log('Rotating right');
                this.rotateLogo(90);
            });
        }
        
        if (flipHorizontalBtn) {
            flipHorizontalBtn.addEventListener('click', () => {
                console.log('Flipping horizontal');
                this.flipLogo('horizontal');
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                console.log('Flipping vertical');
                this.flipLogo('vertical');
            });
        }
        
        if (rotateAngleInput) {
            rotateAngleInput.addEventListener('input', (e) => {
                if (this.selectedLogoIndex >= 0) {
                    const angle = parseInt(e.target.value);
                    if (!isNaN(angle)) {
                        console.log('Setting rotation to:', angle);
                        const logo = this.logos[this.selectedLogoIndex];
                        logo.state.rotation = angle;
                        
                        // 更新进度条样式
                        const container = e.target.closest('.range-container');
                        const percentage = ((angle + 360) % 720) / 720 * 100;
                        container.style.setProperty('--value', `${percentage}%`);
                        
                        this.drawImage();
                    }
                }
            });
        }
    }
    
    // 添加logo点击处理方法
    handleLogoClick(e) {
        const logo = e.target;
        
        // 使用logo的原始尺寸
        const originalWidth = logo.naturalWidth || logo.width;
        const originalHeight = logo.naturalHeight || logo.height;
        
        // 如果logo太大，按比例缩小
        let finalWidth = originalWidth;
        let finalHeight = originalHeight;
        const maxSize = this.canvas.width * 0.8; // 最大尺寸为画布宽度的80%
        
        if (originalWidth > maxSize || originalHeight > maxSize) {
            if (originalWidth > originalHeight) {
                finalWidth = maxSize;
                finalHeight = (originalHeight / originalWidth) * maxSize;
            } else {
                finalHeight = maxSize;
                finalWidth = (originalWidth / originalHeight) * maxSize;
            }
        }
        
        // 创建新的logo状态
        const newLogoState = {
            ...this.defaultLogoState,
            x: (this.canvas.width - finalWidth) / 2,
            y: (this.canvas.height - finalHeight) / 2,
            width: finalWidth,
            height: finalHeight,
            opacity: 1
        };
        
        // 添加新logo到数组
        this.logos.push({
            image: logo,
            state: newLogoState
        });
        
        // 选中新添加的logo
        this.selectedLogoIndex = this.logos.length - 1;
        
        // 启用删除按钮
        this.removeLogo.disabled = false;
        
        // 设置透明度滑块的值和样式
        const opacitySlider = document.getElementById('logoOpacity');
        opacitySlider.value = 100;
        const opacityContainer = opacitySlider.closest('.range-container');
        opacityContainer.style.setProperty('--value', '100%');
        
        // 设置大小滑块的值和样式
        const sizePercent = (finalWidth / this.canvas.width) * 100;
        this.logoSizeSlider.value = sizePercent;
        const sizeContainer = this.logoSizeSlider.closest('.range-container');
        sizeContainer.style.setProperty('--value', `${sizePercent}%`);
        
        this.drawImage();
    }
    
    initializeCanvas() {
        this.canvas.width = window.innerWidth - 240;
        this.canvas.height = window.innerHeight - 120;
        this.ctx.fillStyle = '#836EF9';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// 初始化编辑器
window.addEventListener('load', () => {
    new ImageEditor();
}); 