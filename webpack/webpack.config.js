var path = require('path');

module.exports = {
    context: __dirname,
    entry: "../src/index",
    module: {
        loaders: [
            { test: /\.cjsx$/, loader: "coffee-loader!coffee-react-transform" },
            { test: /\.coffee$/, loader: "coffee-loader" }
        ],
        // to avoid error when requiring 'pixi.js'. see:
        // https://github.com/pixijs/pixi.js/issues/1854
        noParse: [ /.*(pixi\.js).*/ ]
    },
    node: {
        fs: "empty"
    },
    output: {
        path: path.join(__dirname, "/../assets/js/"),
        filename: "bundle.js"
    },
    resolve: {
        extensions: ["", ".js", ".cjsx", ".coffee"],
        modulesDirectories: ["node_modules", "src", "third_party"]
    }
};
