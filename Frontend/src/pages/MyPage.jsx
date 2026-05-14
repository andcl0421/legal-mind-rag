import { Download, FileArchive, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import mungiTalkCard from "../assets/mungi/mungi-talk-card.png";
import { fetchSessions } from "../services/chatService.js";
import {
  deleteEvidenceFile,
  downloadEvidenceFile,
  fetchEvidenceFilesByFilter,
  getEvidenceDownloadUrl,
  uploadEvidenceFile,
} from "../services/evidenceService.js";
import { store } from "../store.js";

const EVIDENCE_CATEGORIES = [
  { value: "", label: "전체" },
  { value: "근로계약서", label: "근로계약서" },
  { value: "급여명세서", label: "급여명세서" },
  { value: "대화 캡처", label: "대화 캡처" },
  { value: "기타", label: "기타" },
];

export default function MyPage() {
  const [sessions, setSessions] = useState([]);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [status, setStatus] = useState("증거 보관함을 불러오는 중입니다.");
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ category: "", chatSessionId: "" });
  const [form, setForm] = useState({
    file: null,
    description: "",
    category: "기타",
    chatSessionId: "",
  });

  const fileInputId = "evidence-upload-input";

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    loadEvidence();
  }, [filters.category, filters.chatSessionId]);

  const sessionMap = useMemo(() => {
    const map = new Map();
    for (const session of sessions) {
      map.set(session.chat_session_id, session);
    }
    return map;
  }, [sessions]);

  async function loadInitial() {
    try {
      const [sessionData] = await Promise.all([fetchSessions()]);
      setSessions(sessionData.sessions || []);
      setStatus("증거 보관함을 불러왔습니다.");
      await loadEvidence();
    } catch (error) {
      setStatus(`불러오기 실패: ${error.message}`);
    }
  }

  async function loadEvidence() {
    try {
      const data = await fetchEvidenceFilesByFilter({
        category: filters.category,
        chatSessionId: filters.chatSessionId,
      });
      setEvidenceFiles(data.items || []);
    } catch (error) {
      setStatus(`증거 목록 조회 실패: ${error.message}`);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!form.file) {
      setStatus("업로드할 파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    try {
      await uploadEvidenceFile(form.file, form.description, form.category, form.chatSessionId);
      setForm((prev) => ({ ...prev, file: null, description: "" }));
      const input = document.getElementById(fileInputId);
      if (input) input.value = "";
      setStatus("파일 업로드가 완료되었습니다.");
      await loadEvidence();
    } catch (error) {
      setStatus(`업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId) {
    try {
      await deleteEvidenceFile(fileId);
      setStatus("파일을 삭제했습니다.");
      await loadEvidence();
    } catch (error) {
      setStatus(`삭제 실패: ${error.message}`);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="nomu-card p-6">
        <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-nomu-line bg-[#F5FBF0]">
          <img src={mungiTalkCard} alt="뭉이 프로필" className="h-full w-full object-cover object-[50%_38%]" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-nomu-dark">마이페이지</h1>
        <p className="mt-2 text-center text-sm font-semibold text-[#6F806C]">증거 보관함 중심 기능 구성</p>
        <div className="mt-4 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
          <p className="text-xs font-black text-[#6F806C]">상태</p>
          <p className="mt-2 text-sm font-semibold text-[#52604F]">{status}</p>
        </div>
      </aside>

      <article className="nomu-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black text-nomu-dark">
            <FileArchive size={20} /> 증거 보관함
          </h2>
          <span className="nomu-chip">총 {evidenceFiles.length}건</span>
        </div>

        <form onSubmit={handleUpload} className="grid gap-3 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4">
          <input
            id={fileInputId}
            type="file"
            onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
            className="w-full rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
            >
              {EVIDENCE_CATEGORIES.filter((item) => item.value).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={form.chatSessionId}
              onChange={(event) => setForm((prev) => ({ ...prev, chatSessionId: event.target.value }))}
              className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
            >
              <option value="">상담 세션 연결 안함</option>
              {sessions.map((session) => (
                <option key={session.chat_session_id} value={session.chat_session_id}>
                  {(session.title || "상담 세션").slice(0, 32)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="설명 (예: 2026.05 급여명세서)"
            className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
          />
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-nomu-dark px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            <Upload size={16} /> {uploading ? "업로드 중..." : "파일 업로드"}
          </button>
        </form>

        <div className="mt-4 grid gap-3 rounded-3xl border border-nomu-line bg-[#FBFDF8] p-4 sm:grid-cols-2">
          <select
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
          >
            {EVIDENCE_CATEGORIES.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={filters.chatSessionId}
            onChange={(event) => setFilters((prev) => ({ ...prev, chatSessionId: event.target.value }))}
            className="rounded-2xl border border-nomu-line bg-white px-4 py-3 text-sm font-semibold"
          >
            <option value="">모든 상담 세션</option>
            {sessions.map((session) => (
              <option key={session.chat_session_id} value={session.chat_session_id}>
                {(session.title || "상담 세션").slice(0, 32)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3">
          {evidenceFiles.length ? (
            evidenceFiles.map((file) => (
              <article key={file.user_file_id} className="rounded-3xl border border-nomu-line bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center">
                  <FilePreview file={file} />
                  <div>
                    <h3 className="text-sm font-black text-nomu-dark">{file.original_filename}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#6F806C]">
                      {formatBytes(file.file_size)} | {file.mime_type}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#7B8878]">{formatDateTime(file.created_at)}</p>
                    <p className="mt-1 text-xs font-black text-[#3F5A3F]">카테고리: {file.category || "미분류"}</p>
                    <p className="mt-1 text-xs font-semibold text-[#52604F]">
                      연결 상담:{" "}
                      {file.chat_session_id
                        ? (sessionMap.get(file.chat_session_id)?.title || "상담 세션").slice(0, 28)
                        : "없음"}
                    </p>
                    {file.description ? <p className="mt-2 text-sm font-semibold text-[#52604F]">{file.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => window.open(getEvidenceDownloadUrl(file.user_file_id), "_blank", "noopener,noreferrer")}
                      className="inline-flex items-center gap-1 rounded-full border border-nomu-line px-3 py-2 text-xs font-black text-nomu-dark"
                    >
                      <FileText size={13} /> 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadEvidenceFile(file.user_file_id, file.original_filename)}
                      className="inline-flex items-center gap-1 rounded-full border border-nomu-line px-3 py-2 text-xs font-black text-nomu-dark"
                    >
                      <Download size={13} /> 다운로드
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(file.user_file_id)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-nomu-line bg-white p-8 text-center text-sm font-bold text-[#7B8878]">
              조건에 맞는 증거 파일이 없습니다.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function FilePreview({ file }) {
  const isImage = String(file.mime_type || "").startsWith("image/");
  const isPdf = String(file.mime_type || "").includes("pdf");
  if (isImage) {
    return <AuthImagePreview file={file} />;
  }
  if (isPdf) {
    return (
      <div className="grid h-24 w-[110px] place-items-center rounded-2xl border border-nomu-line bg-[#F5FBF0] text-[#3F5A3F]">
        <FileText size={30} />
        <span className="text-[11px] font-black">PDF</span>
      </div>
    );
  }
  return (
    <div className="grid h-24 w-[110px] place-items-center rounded-2xl border border-nomu-line bg-[#F5FBF0] text-[#3F5A3F]">
      <ImageIcon size={28} />
      <span className="text-[11px] font-black">FILE</span>
    </div>
  );
}

function AuthImagePreview({ file }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let isMounted = true;
    let objectUrl = "";
    async function loadImage() {
      try {
        if (!store.token) return;
        const response = await fetch(getEvidenceDownloadUrl(file.user_file_id), {
          headers: { Authorization: `Bearer ${store.token}` },
        });
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (isMounted) setPreviewUrl(objectUrl);
      } catch {
        // ignore preview load failure
      }
    }
    loadImage();
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.user_file_id]);

  return (
    <div className="h-24 w-[110px] overflow-hidden rounded-2xl border border-nomu-line bg-[#F5FBF0]">
      {previewUrl ? (
        <img src={previewUrl} alt={file.original_filename} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-[#3F5A3F]">
          <ImageIcon size={26} />
        </div>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size < 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
