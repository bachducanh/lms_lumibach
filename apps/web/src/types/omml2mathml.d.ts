/**
 * `omml2mathml` là gói JavaScript thuần, không kèm khai báo kiểu.
 * Nhận một nút `m:oMath` (hoặc `m:oMathPara`) và trả về một phần tử MathML.
 */
declare module 'omml2mathml' {
  const omml2mathml: (oMathElement: unknown) => unknown;
  export default omml2mathml;
}
