BEGIN TRANSACTION;
CREATE TABLE [Orders] (
    [Id] int NOT NULL IDENTITY,
    [CreatedAt] datetime2 NOT NULL DEFAULT (GETDATE()),
    [UnitPrice] int NOT NULL,
    [Quantity] int NOT NULL,
    [Total] AS Quantity*UnitPrice,
    CONSTRAINT [PK_Orders] PRIMARY KEY ([Id])
);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20251105180247_Order_table', N'9.0.10');

COMMIT;
GO

