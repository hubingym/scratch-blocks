import { terser } from "rollup-plugin-terser";

// 生成压缩文件
export default {
  input: 'shim/vertical.js',
  output: {
    file: 'shim/vertical.min.js',
    format: 'esm',
    plugins: [
      terser(),
    ],
  },
};
