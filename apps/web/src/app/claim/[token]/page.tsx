import ClaimClient from "./claim-client";

interface Props {
  params: Promise<{ token: string }>;
}

// Public landing for a claim link. Anyone with the link can preview the profile
// an admin built and take ownership by verifying their email.
export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  return <ClaimClient token={token} />;
}
