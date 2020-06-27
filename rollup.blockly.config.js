import { terser } from "rollup-plugin-terser";

// 生成压缩文件
export default {
  input: 'blockly_vertical.js',
  output: {
    file: 'shim/blockly_vertical.min.js',
    format: 'esm',
    plugins: [
      terser({
        compress: {
          defaults: false,
        },
      }),
    ],
  },
};
