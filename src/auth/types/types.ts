export type IToken = {
  access_token: string;
  refresh_token: string;
};

export type IUsers = {
  id: number;
  uuid: string;
  email: string;
  password_hash: string;

  full_name: string;
  phone: string;
  is_email_verified: boolean;
  is_active: boolean;

  last_login_at: string;

  created_at: string;
  created_by: number;
  updated_at: string | null;
  updated_by: number;

  deleted_at: string | null;
};

export type ISignupReqObj = {
  email: string;
  password: string;
  full_name: string;
}

export type ILoginReqObj = {
  email: string;
  password: string;
}

export type IComparePasswordObj = {
  plain_text: string;
  hash_text: string;
}

export type ICreateUserReqObj = {
  email: string;
  uuid: string;
  password_hash: string;
  full_name: string;
  is_email_verified: boolean;
  is_active: boolean;
  created_at: string;

  last_login_at: string;
}


export type IUserTokens = {
  id: number;
  uuid: string;

  // Owner
  user_id: number;

  // Free tokens
  free_tokens_granted: number;
  free_tokens_used: number;

  // Paid tokens
  paid_tokens_granted: number;
  paid_tokens_used: number;

  // Derived (generated columns)
  total_tokens_granted: number;
  total_tokens_used: number;
  total_net_tokens: number;

  // Audit fields
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  deleted_at: string | null; // ISO timestamp

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export type ICreateUserTokensReqObj = {
  user_id: number;
  free_tokens_granted: number;
  free_tokens_used: number;
  paid_tokens_granted: number;
  paid_tokens_used: number;

  created_at: string;
  created_by: number | null;
}

export type IFetchUserDetailsWithTokensResObj = IUsers & {
  user_tokens: IFetchUserDetailsWithTokenDetails;
};

export type IFetchUserDetailsWithTokenDetails = {
  id: number;
  user_id: number;

  free_tokens_granted: number;
  free_tokens_used: number;
  
  paid_tokens_granted: number;

  paid_tokens_used: number;
  total_tokens_granted: number;
  total_tokens_used: number;
  total_net_tokens: number;
}