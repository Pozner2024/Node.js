const d=10;

// где-то внутри node:
// var exports = module.exports = {};

// меняем локальную переменную exports, но это никому снаружи не видно - реально экспортируется module.exports
exports={
    d
};
