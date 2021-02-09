String.prototype.insert = function(idx, val) {
  return this.substring(0, idx) + val + this.substring(idx);
};

String.prototype.remove = function(start, end){
  return this.substring(0, start) + this.substring(end);
};

traverse = (o, fn) => {
  for (const i in o) {
    fn.apply(this,[i,o[i]]);  
    if (o[i] !== null && typeof(o[i])=="object") {
      traverse(o[i], fn);
    }
  }
}

exports.traverse = traverse;

exports.literalToString = (literal) => {
  if(literal.type == "http://www.w3.org/2001/XMLSchema#boolean") {
    return literal.value ? "true" : "false";
  } else if(literal.type == "http://www.w3.org/2001/XMLSchema#decimal" || literal.type == "http://www.w3.org/2001/XMLSchema#double" || literal.type == "http://www.w3.org/2001/XMLSchema#integer") {
    return literal.value;
  } else if(literal.type) {
    return `"${literal.value}"^^<${literal.type}>`;
  } else {
    return `"${literal.value}"`;
  }
};

exports.makeRed = (text) => {
  // const red = '\u001b[31m'; // foreground
  const red = '\u001b[41m'; // backgrond
  const reset = '\u001b[0m';
  return red + text + reset;
}


exports.stdinReadSync = () => {
   let b = new Buffer(1024);
   let data = '';

   while (true) {
     let n = fs.readSync(0, b, 0, b.length);
     if (!n) break;
     data += b.toString('utf8', 0, n);
   }
   return data;
}
