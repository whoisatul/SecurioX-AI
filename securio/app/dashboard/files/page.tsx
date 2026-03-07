// app/dashboard/files/page.tsx
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import FileTable from "../../../components/FileTable";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function FileListPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return <p className="text-red-500">Access denied.</p>;
    }

    const files = await prisma.encryptedFile.findMany({
        where: { userId: session.user.id },
        select: {
            id: true,
            fileName: true,
            fileSize: true,
            uploadDate: true,
            cloudinaryPublicId: true,
            encryptedAesKey: true,
        },
        orderBy: { uploadDate: 'desc' },
    });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            encryptedPrivateKey: true,
            isMfaEnabled: true
        }
    });

    if (!user || !user.encryptedPrivateKey) {
        redirect('/onboard-keys');
    }

    return (
        <div className="space-y-5 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">My Encrypted Files</h1>
                    <p className="text-gray-500 text-sm mt-1">{files.length} file{files.length !== 1 ? 's' : ''} stored securely</p>
                </div>
            </div>
            <FileTable
                files={files}
                encryptedPrivateKey={user.encryptedPrivateKey}
                isMfaEnabled={user.isMfaEnabled}
            />
        </div>
    );
}