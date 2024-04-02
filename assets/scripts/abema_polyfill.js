(() => {
    Object.defineProperty(window.navigator, "userAgent", {
        get: () => {
            return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Safari/605.1.15";
        },
    });
})();
