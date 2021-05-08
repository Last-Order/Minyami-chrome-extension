import CommonUtils from './utils/common';
export class Playlist {
    constructor(content, url, title = "", disableAutoParse = false) {
        this.content = content;
        this.url = url;
        this.chunkLists = [];
        this.title = title;
        if (!disableAutoParse) {
            this.parse();
        }
    }
    parse() {
        const lines = this.content.split('\n');
        lines.forEach((line, index) => {
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                const chunkList = {
                    type: 'video'
                };
                if (line.match(/BANDWIDTH=(\d+)/) !== null) {
                    chunkList.bandwidth = line.match(/BANDWIDTH=(\d+)/)[1];
                }
                if (line.match(/RESOLUTION=(.+)(\n|$)/) !== null) {
                    chunkList.resolution = {
                        x: line.match(/RESOLUTION=(.+?)(\n|$|\,)/)[1].split('x')[0],
                        y: line.match(/RESOLUTION=(.+?)(\n|$|\,)/)[1].split('x')[1]
                    }
                }
                chunkList.url = CommonUtils.buildFullUrl(this.url, lines[index + 1]);
                this.chunkLists.push(chunkList);
            }
            if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
                const chunkList = {
                    type: 'audio'
                };
                chunkList.url = CommonUtils.buildFullUrl(this.url, line.match(/URI="(.+?)"/)[1]);
                chunkList.name = line.match(/NAME="(.+?)"/) && line.match(/NAME="(.+?)"/)[1];
                this.chunkLists.push(chunkList);
            }
        });
    }
}