const webpack = require('webpack');

module.exports = {
    // ...existing code...
    plugins: [
        // ...existing plugins...
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
    ],
    // ...existing code...
};
