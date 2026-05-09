import { betterAuth } from 'better-auth';
const auth = betterAuth({ database: { provider: 'sqlite', createAdapter: () => ({}) }});
Promise.resolve(auth.$context).then(c => console.log(Object.keys(c))).catch(e => console.error(e));
