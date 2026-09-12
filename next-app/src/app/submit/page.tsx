"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  Label,
  Select,
  Spinner,
} from "@/components/ui";
import { ApiClientError, apiPost, formatApiErrors, queryFn } from "@/lib/api";

interface LookupItem {
  _id: string;
  name: string;
  code?: string;
}

interface SubmitResult {
  referenceCode: string;
  status: string;
  submittedAt: string;
  subCountyName: string;
  wardName: string;
  categoryName: string;
}

interface WardItem extends LookupItem {
  subCountyId: string;
}

export default function SubmitPage() {
  const [subCountyId, setSubCountyId] = useState("");
  const [wardId, setWardId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const subCounties = useQuery<LookupItem[]>({
    queryKey: ["/public/sub-counties"],
    queryFn,
  });
  const categories = useQuery<LookupItem[]>({
    queryKey: ["/public/categories"],
    queryFn,
  });
  const wards = useQuery<WardItem[]>({
    queryKey: ["/public/wards", { subCountyId }],
    queryFn,
    enabled: Boolean(subCountyId),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiPost<SubmitResult>("/public/grievances", {
        subCountyId,
        wardId,
        categoryId,
        description,
      }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? err.message || formatApiErrors(err.errors)
          : "Something went wrong. Please try again.",
      );
    },
  });

  const _selectedWard = wards.data?.find((w: WardItem) => w._id === wardId);
  const _selectedSubCounty = subCounties.data?.find(
    (s: LookupItem) => s._id === subCountyId,
  );
  const _selectedCategory = categories.data?.find(
    (c: LookupItem) => c._id === categoryId,
  );

  const canSubmit =
    subCountyId && wardId && categoryId && description.trim().length >= 10;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Submit a grievance
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Describe the issue, tell us where it happened and we&apos;ll take it
          from there. You&apos;ll get a reference code to track progress.
        </p>
      </div>

      {result ? (
        <Card className="mx-auto max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <h2 className="text-xl font-bold">Grievance submitted</h2>
            <p className="text-sm text-muted-foreground">
              Keep this reference code to track your grievance:
            </p>
            <div className="rounded-lg bg-secondary px-6 py-3 font-mono text-lg font-bold tracking-widest text-primary">
              {result.referenceCode}
            </div>
            <dl className="mt-2 w-full space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">
                  {result.status.replace("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">
                  {result.wardName}, {result.subCountyName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{result.categoryName}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-3">
              <Link href={`/track?code=${result.referenceCode}`}>
                <Button variant="secondary">Track this grievance</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setSubCountyId("");
                  setWardId("");
                  setCategoryId("");
                  setDescription("");
                }}
              >
                Submit another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Grievance details
            </CardTitle>
            <CardDescription>Fields marked * are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="sub-county">Sub-County *</Label>
              <Select
                id="sub-county"
                value={subCountyId}
                onChange={(e) => {
                  setSubCountyId(e.target.value);
                  setWardId("");
                }}
              >
                <option value="">Select sub-county…</option>
                {subCounties.data?.map((s: LookupItem) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <FormError
                message={
                  subCounties.error ? "Failed to load sub-counties" : undefined
                }
              />
            </div>

            <div>
              <Label htmlFor="ward">Ward *</Label>
              <Select
                id="ward"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                disabled={!subCountyId}
              >
                <option value="">
                  {subCountyId ? "Select ward…" : "Choose a sub-county first"}
                </option>
                {wards.data?.map((w: WardItem) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select category…</option>
                {categories.data?.map((c: LookupItem) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Description *</Label>
              <RichTextEditor value={description} onChange={setDescription} />
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum 10 characters. Links are allowed but only http/https.
              </p>
              <FormError
                message={
                  description.trim() && description.trim().length < 10
                    ? "Description must be at least 10 characters"
                    : undefined
                }
              />
            </div>

            <div className="flex items-center gap-3 border-t pt-4">
              <Button
                onClick={() => submit.mutate()}
                disabled={!canSubmit || submit.isPending}
                size="lg"
              >
                {submit.isPending && (
                  <Spinner className="h-4 w-4 text-primary-foreground" />
                )}
                Submit grievance
              </Button>
              {!subCountyId && (
                <span className="text-sm text-muted-foreground">
                  Please complete the form above.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
