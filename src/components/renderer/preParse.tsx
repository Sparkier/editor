import * as vega from 'vega';

export default function preParse(spec: vega.Spec, prefix = '') {
  for (const key in spec) {
    if (Array.isArray(spec[key])) {
      for (let i = 0; i < spec[key].length; i++) {
        spec[key][i].id = `${prefix}["${key}"][${i}]`;

        if (spec[key][i].type === 'group') {
          preParse(spec[key][i], spec[key][i].id);
        }
      }
    }
  }
  return spec;
}
