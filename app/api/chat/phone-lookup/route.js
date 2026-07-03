// Cross-device history previously returned a full conversation to anyone who
// supplied the matching phone number. Phone-number knowledge is not identity
// verification, so the feature remains disabled until an OTP flow exists.

export async function POST() {
  return Response.json(
    { error: 'Cross-device chat history requires phone verification.' },
    { status: 403 }
  )
}
