class Icon {
    constructor(image) {
        this._image = image;
        const canvas = document.createElement('canvas');
        this._canvas = canvas;
        canvas.width = image.width;
        canvas.height = image.height;
        this.reset();
    }
    get canvasContext() { return this._canvas.getContext('2d'); }
    get imageData() {
        return this.canvasContext.getImageData(
            0, 0, this._canvas.width, this._canvas.height);
    }
    // inactive
    reset() {
        this.canvasContext.drawImage(this._image, 0, 0);
        this.setIcon();
        return true;
    }
    // active, default
    setStopped() { return this.setIconFiltered(); }
    // active, red -> yellow
    setWaiting() { return this.setIconFiltered('hue-rotate(45deg)'); }
    // active, red -> green
    setReady() { return this.setIconFiltered('hue-rotate(90deg)'); }
    setIcon() { chrome.browserAction.setIcon({'imageData': this.imageData}); }
    setIconFiltered(filterString) {
        const ctx = this.canvasContext;
        // add vibrance when active
        const filter = 'brightness(87.5%) contrast(175%) saturate(175%) ' +
            (filterString ? filterString : '');
        ctx.filter = filter;
        if (ctx.filter !== filter) {
            console.error('Invalid canvas filter string.');
            return false;
        }
        ctx.drawImage(this._image, 0, 0);
        this.setIcon();
        ctx.filter = 'none';
        return true;
    }
}

export default Icon;