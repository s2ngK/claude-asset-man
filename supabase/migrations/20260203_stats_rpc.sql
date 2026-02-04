-- Supabase SQL Editor에서 이 스크립트를 실행하세요.
-- 통계 화면(StatsView)에서 사용할 서버 사이드 집계 함수입니다.

-- 1. 카테고리별 지출 합계 (파이 차트용)
CREATE OR REPLACE FUNCTION get_monthly_category_stats(
  _group_id UUID,
  _month_start DATE,
  _month_end DATE
)
RETURNS TABLE (
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  total_amount BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    c.color,
    c.icon,
    SUM(t.amount) as total_amount
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.group_id = _group_id
    AND t.date >= _month_start
    AND t.date <= _month_end
    AND t.type = 'expense'
  GROUP BY c.name, c.color, c.icon
  ORDER BY total_amount DESC;
END;
$$;

-- 2. 멤버별 지출 합계 (랭킹용)
CREATE OR REPLACE FUNCTION get_monthly_member_stats(
  _group_id UUID,
  _month_start DATE,
  _month_end DATE
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  total_amount BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.user_id,
    p.full_name,
    SUM(t.amount) as total_amount
  FROM transactions t
  LEFT JOIN profiles p ON t.user_id = p.id
  WHERE t.group_id = _group_id
    AND t.date >= _month_start
    AND t.date <= _month_end
    AND t.type = 'expense'
  GROUP BY t.user_id, p.full_name
  ORDER BY total_amount DESC;
END;
$$;

-- 3. 월별 추이 (Bar 차트용 - 최근 6개월)
-- 입력받은 _end_date 기준으로 6개월 전부터의 월별 수입/지출 합계
CREATE OR REPLACE FUNCTION get_monthly_trend(
  _group_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE (
  month TEXT,
  income BIGINT,
  expense BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_trunc('month', t.date), 'YYYY-MM') as month,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
  FROM transactions t
  WHERE t.group_id = _group_id
    AND t.date >= _start_date
    AND t.date <= _end_date
  GROUP BY date_trunc('month', t.date)
  ORDER BY month ASC;
END;
$$;
