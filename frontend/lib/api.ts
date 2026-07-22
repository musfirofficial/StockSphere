const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized - Please log in again");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    let errorMessage = "An error occurred";
    
    if (typeof errorData.detail === "string") {
      errorMessage = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      // FastAPI 422 validation errors array format [{ loc, msg, type }]
      errorMessage = errorData.detail.map((err: any) => `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`).join('\n');
    } else if (errorData.detail && typeof errorData.detail === "object") {
      errorMessage = JSON.stringify(errorData.detail);
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }

    throw new Error(errorMessage);
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
