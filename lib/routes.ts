function withVersion(path: string, version?: string | null) {
  return version ? `${path}?version=${encodeURIComponent(version)}` : path;
}

export const routes = {
  auth: {
    login: "/login"
  },
  admin: {
    masterData: "/admin/master-data",
    users: "/admin/users"
  },
  ptc: {
    dashboard: "/ptc/dashboard",
    applications: "/ptc/applications",
    application: (id: string) => `/ptc/applications/${id}`,
    newApplication: (version?: string | null) => withVersion("/ptc/applications/new", version),
    feesCalculator: "/ptc/fees-calculator"
  },
  ptt: {
    applications: "/ptt/applications",
    application: (id: string) => `/ptt/applications/${id}`,
    newApplication: (version?: string | null) => withVersion("/ptt/applications/new", version)
  },
  ptcReports: {
    missingDocuments: "/ptc-report/missing-documents",
    documentSummary: "/ptc-report/document-summary",
    documentCoverage: "/ptc-report/document-coverage",
    applicationSummary: "/ptc-report/application-summary",
    completionSummary: "/ptc-report/completion-summary",
    documentCombinations: "/ptc-report/document-combinations"
  }
} as const;
