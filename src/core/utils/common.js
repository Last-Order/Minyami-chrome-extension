class CommonUtils {
    static buildFullUrl(host, path) {
        return new URL(path, host).href;
    }
}

export default CommonUtils;
