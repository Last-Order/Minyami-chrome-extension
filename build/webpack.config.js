const fs = require("fs");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const generateHTMLPluginConf = (input) => {
    const result = [];
    for (const file of Object.keys(input)) {
        result.push(
            new HtmlWebpackPlugin({
                filename: path.resolve(__dirname, `../dist/${file}/index.html`),
                template: path.resolve(__dirname, "../src/index.html"),
                chunks: ["vendors", input[file]["output"]],
            })
        );
    }
    return result;
};

const generateEntries = (input) => {
    const result = {};
    for (const file of Object.keys(input)) {
        result[input[file]["output"]] = path.resolve(
            __dirname,
            `../src/${input[file]["input"]}`
        );
    }
    return result;
};

const generateConfig = (input) => {
    return {
        mode: "production",
        entry: generateEntries(input),
        resolve: {
            extensions: [".js", ".vue"],
        },
        plugins: [
            new CleanWebpackPlugin({
                verbose: true,
            }),
            new CopyWebpackPlugin([
                {
                    from: path.resolve(__dirname, "../assets/**/*"),
                    to: path.resolve(__dirname, "../dist/"),
                },
            ]),
            new ExtractTextPlugin("[name].css"),
            ...generateHTMLPluginConf(input),
            {
                apply: (compiler) => {
                    compiler.hooks.afterEmit.tap("AfterEmitPlugin", () => {
                        console.log("Write manifest");
                        const manifest = JSON.parse(
                            fs.readFileSync(
                                path.resolve(__dirname, "../manifest.json")
                            )
                        );
                        fs.writeFileSync(
                            path.resolve(__dirname, "../dist/manifest.json"),
                            JSON.stringify(manifest, null, 2)
                        );
                    });
                },
            },
        ],
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: "vue-loader",
                    options: {
                        extractCSS: true,
                    },
                },
                {
                    test: /\.css$/,
                    loader: "style-loader!css-loader",
                },
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    loader: "url-loader",
                },
            ],
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, `../dist/`),
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    commons: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "vendors",
                        chunks: "all",
                    },
                },
                name: true,
            },
        },
    };
};

module.exports = [
    generateConfig({
        background: {
            input: "pages/background/index.js",
            output: "background/bundle",
        },
        config: {
            input: "pages/config/index.js",
            output: "config/bundle",
        },
    }),
];
