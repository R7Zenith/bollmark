import { withAuth } from "next-auth/middleware";

// /admin altindaki tum sayfalari giris yapmis yonetici ile sinirlar.
// /admin/login sayfasi withAuth tarafindan otomatik olarak disarida tutulur.
export default withAuth({
  pages: {
    signIn: "/admin/login"
  }
});

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"]
};
