using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Task_Management_System_API.Migrations
{
    /// <inheritdoc />
    public partial class Addeduserid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IDX_TASK_NAME",
                table: "Task");

            migrationBuilder.DropIndex(
                name: "IDX_PROJ_NAME",
                table: "Project");

            migrationBuilder.AddColumn<Guid>(
                name: "Userid",
                table: "Task",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "Userid",
                table: "Project",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IDX_TASK_NAME_USERID",
                table: "Task",
                columns: new[] { "Title", "Userid" });

            migrationBuilder.CreateIndex(
                name: "IDX_PROJ_NAME_USERID",
                table: "Project",
                columns: new[] { "Name", "Userid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IDX_TASK_NAME_USERID",
                table: "Task");

            migrationBuilder.DropIndex(
                name: "IDX_PROJ_NAME_USERID",
                table: "Project");

            migrationBuilder.DropColumn(
                name: "Userid",
                table: "Task");

            migrationBuilder.DropColumn(
                name: "Userid",
                table: "Project");

            migrationBuilder.CreateIndex(
                name: "IDX_TASK_NAME",
                table: "Task",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IDX_PROJ_NAME",
                table: "Project",
                column: "Name");
        }
    }
}
