export function validateUsername(p) {
  let error = '';
  const hint = null;
  let valid = true;

  if ((p && p.length <= 3 && p.length>=1)) {
    error += 'At least 3 letters. ';
    // error += t('msg.error.signUpRules.atLeast8Char');
    valid = false;
  }
  return { error, valid, hint };

}
