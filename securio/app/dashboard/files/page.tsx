// app/dashboard/files/page.tsx
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import FileTable from "../../../components/FileTable";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

// Server Component: fetches data and passes it to the client component (FileTable)
export default async function FileListPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return <p className="text-red-500">Access denied.</p>;
    }

    // Fetch all encrypted file records for the current user
    const files = await prisma.encryptedFile.findMany({
        where: { userId: session.user.id },
        select: {
            id: true,
            fileName: true,
            fileSize: true,
            uploadDate: true,
            cloudinaryPublicId: true,
            encryptedAesKey: true, // Needed by the Decryption flow
        },
        orderBy: { uploadDate: 'desc' },
    });

    // Fetch the user's master encrypted private key and MFA status
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { 
            encryptedPrivateKey: true, 
            isMfaEnabled: true 
        }
    });

    if (!user || !user.encryptedPrivateKey) {
        // Hard fail: Must finish key onboarding
        redirect('/onboard-keys');
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">My Encrypted Files</h1>
            <p className="text-white">Total Files: {files.length}</p>
            <FileTable 
                files={files} 
                encryptedPrivateKey={user.encryptedPrivateKey}
                isMfaEnabled={user.isMfaEnabled}
            />
        </div>
    );
}