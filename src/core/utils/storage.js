let setHistoryLock = false;

class Storage {
    static async clear() {
        return await Storage.set("history", JSON.stringify({}));
    }
    static async get(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (data) => {
                resolve(key === null ? data : data[key]);
            });
        });
    }
    static async set(key, value) {
        return new Promise(async (resolve, reject) => {
            const current = await Storage.get(null);
            chrome.storage.local.set(
                {
                    ...current,
                    [key]: value
                },
                resolve
            );
        });
    }
    static async getHistory(url) {
        const history = await Storage.get("history");
        if (!history) {
            return [];
        }
        try {
            const parsedHistory = JSON.parse(history);
            return parsedHistory[url] || [];
        } catch (e) {
            return [];
        }
    }
    static async removeHistory(url) {
        const history = await Storage.get("history");
        if (!history) {
            await Storage.set("history", JSON.stringify({}));
            return true;
        }
        try {
            const parsedHistory = JSON.parse(history);
            if (parsedHistory[url]) {
                delete parsedHistory[url];
                await Storage.set("history", JSON.stringify(parsedHistory));
            } else {
                return false;
            }
            return true;
        } catch (e) {
            await Storage.set("history", JSON.stringify({}));
            return true;
        }
    }
    static async setHistory(url, item) {
        if (setHistoryLock) {
            setTimeout(() => {
                Storage.setHistory(url, item);
            }, 200);
            return;
        }
        setHistoryLock = true;
        const history = await Storage.get("history");
        if (!history) {
            const newHistory = {
                url: [item]
            };
            await Storage.set("history", JSON.stringify(newHistory));
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
            await Storage.set("history", JSON.stringify(parsedHistory));
            return true;
        } catch (e) {
            const newHistory = {};
            newHistory[url] = [item];
            await await Storage.set("history", JSON.stringify(newHistory));
            return true;
        } finally {
            setHistoryLock = false;
        }
    }
    static async getConfig(key) {
        const config = await Storage.get("config");
        if (!config) {
            return undefined;
        }
        try {
            return config[key];
        } catch (e) {
            await Storage.set("config", {});
            return undefined;
        }
    }
    static async setConfig(key, value) {
        const config = await Storage.get("config");
        if (!config) {
            await Storage.set("config", { [key]: value });
        }
        try {
            config[key] = value;
            await Storage.set("config", {
                ...config,
                [key]: value
            });
        } catch (e) {
            await Storage.set("config", { [key]: value });
        }
    }
}

export default Storage;
