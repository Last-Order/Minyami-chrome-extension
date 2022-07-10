const fs = require("fs");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const generateHTMLPluginConf = (input) => {
    const result = [];
    for (const file of Object.keys(input)) {
        result.push(
            new HtmlWebpackPlugin({
                filename: path.resolve(__dirname, `../dist/${file}/index.html`),
                template: path.resolve(__dirname, "../src/index.html"),
                chunks: ["vendors", input[file]["output"]]
            })
        );
    }
    return result;
};

const generateEntries = (input) => {
    const result = {};
    for (const file of Object.keys(input)) {
        result[input[file]["output"]] = path.resolve(__dirname, `../src/${input[file]["input"]}`);
    }
    return result;
};

const generateConfig = (input) => {
    return {
        mode: "production",
        devtool: "source-map",
        entry: generateEntries(input),
        resolve: {
            extensions: [".js", ".vue"]
        },
        plugins: [
            new CleanWebpackPlugin({
                verbose: true
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "../assets/"),
                        to: path.resolve(__dirname, "../dist/assets")
                    }
                ]
            }),
            new VueLoaderPlugin(),
            new MiniCssExtractPlugin(),
            ...generateHTMLPluginConf(input),
            {
                apply: (compiler) => {
                    compiler.hooks.afterEmit.tap("AfterEmitPlugin", () => {
                        console.log("Write manifest");
                        const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../manifest.json")));
                        fs.writeFileSync(
                            path.resolve(__dirname, "../dist/manifest.json"),
                            JSON.stringify(manifest, null, 2)
                        );
                    });
                }
            }
        ],
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: "vue-loader",
                    options: {
                        extractCSS: true
                    }
                },
                {
                    test: /\.css$/,
                    use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"]
                },
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    type: "asset/resource"
                }
            ]
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, `../dist/`)
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    commons: {
                        test: /[\\/]node_modules[\\/]/,
                        name: "vendors",
                        chunks: "all"
                    }
                }
            },
            minimizer: [
                // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
                `...`,
                new CssMinimizerPlugin()
            ]
        }
    };
};

module.exports = [
    generateConfig({
        background: {
            input: "pages/background/index.js",
            output: "background"
        },
        config: {
            input: "pages/config/index.js",
            output: "config/bundle"
        }
    })
];
