-- Phương án trắc nghiệm, phát biểu Đúng/Sai nhiều ý và lời giải thích chuyển từ
-- chữ thuần sang rich-text (HTML của trình soạn thảo), để soạn được in đậm, đoạn
-- mã, công thức, ảnh, xuống dòng — giống như đề bài.
--
-- Chỉ đổi DẠNG LƯU, không đổi thứ học sinh nhìn thấy: chữ thuần được escape rồi
-- bọc <p>, nên phương án "Thẻ <p>" vẫn hiện đúng là "Thẻ <p>". Công thức $...$
-- giữ nguyên chữ vì bộ dựng công thức cho HTML cũng đọc quy ước đó.
--
-- Danh sách loại câu phải khớp apps/web/src/lib/rich-options.ts.
-- Chạy đúng một lần — chạy lại sẽ escape thêm một lớp nữa.

-- 1. Phương án. Ô nhập cũ là <input> một dòng, không có dấu xuống dòng; vẫn xử
--    lý cho chắc, mỗi dòng một đoạn.
UPDATE "QuestionOption" o
SET content = '<p>'
  || replace(
       replace(replace(replace(replace(o.content, E'\r', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
       E'\n', '</p><p>')
  || '</p>'
FROM "Question" q
WHERE o."questionId" = q.id
  AND q.type IN ('MULTIPLE_CHOICE_SINGLE', 'MULTIPLE_CHOICE_MULTIPLE', 'TRUE_FALSE_MULTI');

-- 2. Giải thích rỗng thì bỏ hẳn, khỏi hiện một ô "Giải thích" trống trơn.
UPDATE "Question" SET explanation = NULL
WHERE explanation IS NOT NULL AND btrim(explanation) = '';

-- 3. Giải thích có hai nguồn, hai dạng:
--
--    a) Nhập từ Word (bản trước): dòng đầu là "<p>CHỮ</p>" với CHỮ CHƯA escape,
--       các đoạn sau là HTML trần nối bằng dấu xuống dòng — hiển thị ra thành
--       nguyên văn thẻ <p>. Escape lại CHỮ của dòng đầu và bọc từng đoạn sau
--       vào <p> của riêng nó.
--    b) Gõ tay trong ô textarea: chữ thuần, escape rồi mỗi dòng một đoạn.
--
--    Trong regex của Postgres, dấu ngoặc bên trong (?!...) không bắt nhóm, nên
--    \1 là ([^\n]*).
UPDATE "Question"
SET explanation = CASE
  WHEN explanation ~ E'^<p>[^\n]*</p>(\n|$)' THEN
    '<p>'
      || replace(replace(replace(
           substring(explanation from E'^<p>([^\n]*)</p>'),
           '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
      || '</p>'
      || regexp_replace(
           coalesce(substring(replace(explanation, E'\r', '') from E'^[^\n]*(\n.*)$'), ''),
           E'\n(?!<(p|ul|ol|pre|table|h[1-6]|blockquote|div)[ >])([^\n]*)',
           '<p>\1</p>',
           'g')
  ELSE
    '<p>'
      || replace(
           replace(replace(replace(replace(explanation, E'\r', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
           E'\n', '</p><p>')
      || '</p>'
END
WHERE explanation IS NOT NULL;
