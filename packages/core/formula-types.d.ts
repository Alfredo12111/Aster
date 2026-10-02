declare module "fast-formula-parser" {
  class FormulaParser {
    constructor(config?:any);
    functions:Record<string,Function>;
    parse(formula:string,position:{sheet:string;row:number;col:number},array?:boolean):any;
    static FormulaError:{new(code:string):Error};
  }
  export default FormulaParser;
}
