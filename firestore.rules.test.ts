import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: "test-auth",
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });

  const adminCtx = testEnv.authenticatedContext('admin_uid', { email: 'sauravdhapola04@gmail.com', email_verified: true });
  
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('target_uid').set({
      name: 'Target User',
      email: 'target@test.com',
      points: 100,
      role: 'USER'
    });
  });

  try {
    const firestore = adminCtx.firestore();
    const FieldValue = require('firebase/firestore').serverTimestamp; // fake
    await assertSucceeds(firestore.collection('users').doc('target_uid').update({
      points: 0,
    }));
    console.log("SUCCESS");
  } catch(e: any) {
    console.error("FAIL", e);
  }
}

main();
