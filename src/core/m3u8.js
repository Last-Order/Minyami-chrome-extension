import CommonUtils from "./utils/common";
export class Chunklist {
    constructor(type) {
        this.type = type;
        this.fileExt = "ts";
        this.parsed = false;
    }
    set content(value) {
        switch (value.match(/#EXT-X-MAP:URI=".*\.(\w+)(\?|")/m)?.[1]) {
            case "cmfv":
                this.fileExt = "m4v.ts";
            case "cmfa":
                this.fileExt = "m4a.ts";
        };
        if (this.keyUrl) return this.parsed = true;
        const keyUrlMatch = value.match(/#EXT-X-KEY:.*URI="(abematv-license:|https:.*).*?"/);
        if (keyUrlMatch) {
            this.keyUrl = keyUrlMatch[1];
        }
        this.parsed = true;
    }
}

export class Playlist {
    constructor({ content, url, title = "", streamName, disableAutoParse = false }) {
        this.content = content;
        this.url = url;
        this.chunkLists = [];
        this.title = title;
        this.streamName = streamName;
        if (!disableAutoParse) {
            this.parse();
        }
    }
    parse() {
        const lines = this.content.split("\n");
        lines.forEach((line, index) => {
            if (line.startsWith("#EXT-X-STREAM-INF")) {
                const chunkList = new Chunklist("video");
                if (line.match(/BANDWIDTH=(\d+)/) !== null) {
                    chunkList.bandwidth = line.match(/BANDWIDTH=(\d+)/)[1];
                }
                if (line.match(/RESOLUTION=(.+)(\n|$)/) !== null) {
                    chunkList.resolution = {
                        x: line.match(/RESOLUTION=(.+?)(\n|$|\,)/)[1].split("x")[0],
                        y: line.match(/RESOLUTION=(.+?)(\n|$|\,)/)[1].split("x")[1]
                    };
                }
                if (this.url.includes("nicolive")) {
                    chunkList.keyUrl = `nicolive://${this.url.match(/nicolive-production-pg(\d+)/)[1]}`;
                };
                chunkList.url = CommonUtils.buildFullUrl(this.url, lines[index + 1]);
                this.chunkLists.push(chunkList);
            } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
                const chunkList = new Chunklist("audio");
                chunkList.url = CommonUtils.buildFullUrl(this.url, line.match(/URI="(.+?)"/)[1]);
                chunkList.name = line.match(/NAME="(.+?)"/) && line.match(/NAME="(.+?)"/)[1];
                this.chunkLists.push(chunkList);
            }
        });
    }
}
