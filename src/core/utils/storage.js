class Storage {
    static getHistory(url) {
        const history = localStorage.getItem('history');
        if (!history) {
            return [];
        }
        try {
            const parsedHistory = JSON.parse(history);
            if (parsedHistory[url]) {
                return parsedHistory[url];
            } else {
                return [];
            }
        } catch (e) {
            return [];
        }
    }
    static removeHistory(url) {
        const history = localStorage.getItem('history');
        if (!history) {
            localStorage.setItem('history', '{}');
            return true;
        }
        try {
            const parsedHistory = JSON.parse(history);
            if (parsedHistory[url]) {
                delete parsedHistory[url];
                localStorage.setItem('history', JSON.stringify(parsedHistory));
            } else {
                return false;
            }
            return true;
        } catch (e) {
            localStorage.setItem('history', '{}');
            return true;
        }
    }
    static setHistory(url, item) {
        const history = localStorage.getItem('history');
        if (!history) {
            const newHistory = {};
            newHistory[url] = [item];
            localStorage.setItem('history', JSON.stringify(newHistory));
            return true;
        }
        try {
            const parsedHistory = JSON.parse(history);
            if (parsedHistory[url]) {
                if (Array.isArray(parsedHistory[url])) {
                    parsedHistory[url].push(item);
                } else {
                    parsedHistory[url] = [item];
                }
            } else {
                parsedHistory[url] = [item];
            }
            localStorage.setItem('history', JSON.stringify(parsedHistory));
            return true;
        } catch (e) {
            const newHistory = {};
            newHistory[url] = [item];
            localStorage.setItem('history', JSON.stringify(newHistory));
            return true;
        }
    }
    static getConfig(key) {
        const config = localStorage.getItem('config');
        if (!config) {
            return undefined;
        }
        try {
            const parsedConfig = JSON.parse(config);
            return parsedConfig[key];
        } catch (e) {
            localStorage.setItem('config', '{}');
            return undefined;
        }
    }
    static setConfig(key, value) {
        const config = localStorage.getItem('config');
        if (!config) {
            localStorage.setItem('config', JSON.stringify({[key]: value}));
        }
        try {
            const parsedConfig = JSON.parse(config);
            parsedConfig[key] = value;
            localStorage.setItem('config', JSON.stringify(parsedConfig));
        } catch (e) {
            localStorage.setItem('config', JSON.stringify({[key]: value}));
        }
    }
}

export default Storage;