import CommonUtils from "./utils/common";
const FILE_EXTS = {
    cmfv: "m4v.ts",
    cmfa: "m4a.ts",
};
export class Chunklist {
    constructor(type) {
        this.type = type;
        this.fileExt = "ts";
        this.parsed = false;
    }
    set content(value) {
        const extMatch = value.match(/#EXT-X-MAP:URI=".*\.(\w+)(\?|")/m);
        if (extMatch && extMatch[1] in FILE_EXTS) {
            this.fileExt = FILE_EXTS[extMatch[1]];
        }
        if ("keyUrl" in this) return this.parsed = true;
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
