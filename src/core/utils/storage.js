class WaitQueue {
    constructor() {
        this.queue = Promise.resolve();
    }
    check() {
        return { end: this.queue };
    }
    join() {
        let release;
        const nextPromise = new Promise((resolve) => {
            release = resolve;
        });
        const end = this.queue;
        this.queue = this.queue.then(() => nextPromise);
        return { end, leave: () => release() };
    }
}

const historyQueue = new WaitQueue();
const configQueue = new WaitQueue();

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
        const queue = historyQueue.check();
        await queue.end;
        const history = await Storage.get("history");
        try {
            if (!history) return [];
            const parsedHistory = JSON.parse(history);
            return parsedHistory[url] || [];
        } catch (e) {
            return [];
        }
    }
    static async removeHistory(url) {
        const queue = historyQueue.join();
        await queue.end;
        const history = await Storage.get("history");
        try {
            if (!history) {
                await Storage.set("history", JSON.stringify({}));
                return true;
            }
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
        } finally {
            queue.leave();
        }
    }
    static async addHistory(url, item, dupTester) {
        return await this.setHistory(url, item, (array) => {
            if (!array.includes(item) &&
            (typeof dupTester !== "function" || !array.some(dupTester))) {
                array.push(item);
                return true;
            }
            return false;
        });
    }
    static async modHistory(url, item, targetTester) {
        return await this.setHistory(url, item, (array) => {
            if (!array.includes(item) && typeof targetTester === "function") {
                const index = array.findIndex(targetTester);
                if (index > -1) {
                    array[index] = item;
                    return true;
                }
            }
            return false;
        });
    }
    static async setHistory(url, item, historyArrayAction) {
        const queue = historyQueue.join();
        await queue.end;
        const history = await Storage.get("history");
        try {
            if (!history) {
                await Storage.set("history", JSON.stringify({ url: [item] }));
                return true;
            }    
            const parsedHistory = JSON.parse(history);
            if (parsedHistory[url] && Array.isArray(parsedHistory[url])) {
                if (!historyArrayAction(parsedHistory[url])) {
                    return false;
                }
            } else {
                parsedHistory[url] = [item];
            }
            await Storage.set("history", JSON.stringify(parsedHistory));
            return true;
        } catch (e) {
            await Storage.set("history", JSON.stringify({ url: [item] }));
            return true;
        } finally {
            queue.leave();
        }
    }
    static async getConfig(key) {
        const queue = configQueue.check();
        await queue.end;
        const config = await Storage.get("config");
        try {
            if (!config) return undefined;
            return config[key];
        } catch (e) {
            await Storage.set("config", {});
            return undefined;
        }
    }
    static async setConfig(key, value) {
        const queue = configQueue.join();
        await queue.end;
        const config = await Storage.get("config");
        try {
            if (!config) {
                return await Storage.set("config", { [key]: value });
            }
            config[key] = value;
            await Storage.set("config", config);
        } catch (e) {
            await Storage.set("config", { [key]: value });
        } finally {
            queue.leave();
        }
    }
}

export default Storage;
