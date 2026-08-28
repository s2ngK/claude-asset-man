import { type NextRequest, NextResponse, type ProxyConfig } from 'next/server';

/**
 * 쿠키에 담긴 JWT 가 **이미 만료됐는지**만 본다. 서명은 검증하지 않는다.
 *
 * 여기서 하는 일은 보안 경계가 아니라 화면 전환이다. 실제 검증은 API 가 매 요청에서
 * 한다 — 위조 토큰을 들고 와도 화면만 열릴 뿐 데이터는 한 줄도 못 받는다.
 * 반대로 만료를 여기서 걸러주면, 로그인된 모습으로 열렸다가 빈 목록만 보이는 상태를
 * 애초에 안 만든다.
 */
function isExpired(token: string): boolean {
  const payload = token.split('.')[1];
  if (!payload) return true;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    // exp 가 없는 토큰은 우리가 발급한 게 아니다. 만료 판단을 하지 않고 API 에 맡긴다.
    if (typeof claims.exp !== 'number') return false;
    return claims.exp * 1000 <= Date.now();
  } catch {
    return true; // 읽을 수 없는 토큰은 만료로 친다
  }
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const hasValidToken = token !== undefined && !isExpired(token);
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  // 관리자 화면은 **사용자 로그인과 무관하다.** 자기 인증(관리자 토큰)을 따로 하고,
  // 그 토큰은 sessionStorage 에 있어 여기서는 보이지도 않는다. 그냥 통과시킨다.
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');

  if (isAdminPage) return NextResponse.next();

  if (!hasValidToken && !isLoginPage) {
    const url = new URL('/login', request.url);
    // 쿠키가 아예 없으면 그냥 안 한 로그인이다. 만료로 튕긴 경우에만 이유를 알린다.
    if (token !== undefined) url.searchParams.set('reason', 'expired');
    const response = NextResponse.redirect(url);
    if (token !== undefined) response.cookies.delete('token'); // 죽은 쿠키를 남겨두지 않는다
    return response;
  }
  if (hasValidToken && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config: ProxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
