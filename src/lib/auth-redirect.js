/** Keep verification and sign-in returns within this application. @param {unknown} value */
export function accountReturnPath(value) {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/account';
 return value;
}
