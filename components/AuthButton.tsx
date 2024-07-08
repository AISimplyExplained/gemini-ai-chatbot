"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export const AuthButton = () => {
  const { data: session } = useSession();
  return (
      <button
        className="bg-black text-white px-2 py-5 rounded"
        onClick={() => session ? signOut() : signIn('azure-ad')}
      >
        {session ? "Sign Out" : "Sign In"}
      </button>
  );
};